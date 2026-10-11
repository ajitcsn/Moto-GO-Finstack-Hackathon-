import pytest

PAN_OK = "ABCDE1234F"


def intake(amount=120000, **over):
    v = {"model_id": "royal-enfield-hunter-350", "new_or_used": "new", "city": "Pune", "quote": 160000,
         "amount": amount, "contribution": 160000 - amount, "tenure": "24", "applicant_type": "salaried", "adult": True}
    v.update(over)
    return v


def start(api, **kw):
    r = api.post("/applications", {"values": intake(**kw)}, headers={"Idempotency-Key": f"k-{kw}"})
    assert r.status_code == 201, r.text
    return r.json()


def put(api, app, step, values):
    return api.put(f"/applications/{app['id']}/steps/{step}", {"values": values, "submit": True})


def run_to_underwriting(api, app, pan=PAN_OK, kyc="pan_ckyc"):
    a = app["id"]
    r = put(api, app, "identity", {"legal_name": "Asha Rao", "dob": "1995-04-12", "address": "12 MG Road, Pune",
                                   "pincode": "411001", "pan": pan, "employment": "private_salaried", "income": 55000,
                                   "existing_emis": 0, "application_consent": True})
    assert r.status_code == 200, r.text
    r = put(api, app, "kyc", {"kyc_method": kyc, "retrieval_consent": True})
    assert r.status_code == 200, r.text
    return a


def finish(api, app):
    a = app["id"]
    assert put(api, app, "bureau", {"bureau_consent": True}).status_code == 200
    r = put(api, app, "evidence", {"route": "aa", "aa_consent": True})
    assert r.json()["redirect"]["provider"] == "aa"
    assert api.post("/mock/provider/aa/complete", {"application_id": a}).status_code == 200
    slip = api.upload("salary_slip", "slip.pdf", app_id=a)
    assert slip["status"] == "verified"
    assert put(api, app, "work", {"employer": "Acme", "tenure_months": 30, "salary_slip": slip["id"]}).status_code == 200
    quote = api.upload("dealer_quote", "quote.pdf", app_id=a)
    r = put(api, app, "vehicle", {"dealer": "City Motors", "variant": "Metro", "quote_document": quote["id"]})
    assert r.status_code == 200, r.text
    return api.get(f"/applications/{a}").json()


def test_intake_rules(api):
    api.login("9999900002")
    r = api.post("/applications", {"values": intake(amount=120000, contribution=10000)})
    assert r.status_code == 422 and "equal the quote" in r.json()["message"]
    r = api.post("/applications", {"values": intake(applicant_type="self_employed")})
    assert r.status_code == 422 and r.json()["code"] == "unsupported_applicant"
    r = api.post("/applications", {"values": intake(model_id="maruti-suzuki-swift", quote=700000, amount=100000, contribution=600000)})
    assert r.json()["code"] == "unsupported_vehicle"
    # idempotency: same key returns the same application
    a = api.post("/applications", {"values": intake()}, headers={"Idempotency-Key": "same"}).json()
    b = api.post("/applications", {"values": intake()}, headers={"Idempotency-Key": "same"}).json()
    assert a["id"] == b["id"]


def test_step_validation_and_pan_masking(api):
    api.login("9999900002")
    app = start(api)
    r = put(api, app, "identity", {"legal_name": "A", "dob": "2015-01-01", "pan": "bad", "pincode": "12"})
    assert r.status_code == 422
    fields = {e["field"] for e in r.json()["errors"]}
    assert {"legal_name", "dob", "pan", "pincode", "address", "application_consent"} <= fields
    assert put(api, app, "kyc", {}).json()["code"] == "step_out_of_order"
    put(api, app, "identity", {"legal_name": "Asha Rao", "dob": "1995-04-12", "address": "12 MG Road, Pune", "pincode": "411001",
                               "pan": PAN_OK, "employment": "private_salaried", "income": 55000, "existing_emis": 0,
                               "application_consent": True})
    sch = api.get(f"/applications/{app['id']}/steps/identity/schema").json()
    assert sch["values"]["pan"] == "••••••" + PAN_OK[-4:] and "ABCDE" not in str(sch["values"])
    assert sch["demo"] is True
    # re-submitting with the masked value keeps the stored PAN
    vals = dict(sch["values"], application_consent=True)
    assert put(api, app, "identity", vals).status_code == 200


def test_happy_path_to_garage_handoff(api):
    api.login("9999900002")
    app = start(api, amount=120000)
    run_to_underwriting(api, app)
    got = finish(api, app)
    assert got["state"] == "offered" and got["current_step"] == "offers"
    offers = api.get(f"/applications/{app['id']}/offers").json()["items"]
    assert len(offers) >= 2 and all(o["apr"] >= o["rate"] for o in offers)
    o = offers[0]
    kfs = api.get(f"/applications/{app['id']}/offers/{o['id']}/kfs").json()
    assert "Cooling-off period" in str(kfs)
    # cannot accept without KFS acknowledgement or with a stale version
    path = f"/applications/{app['id']}/offers/{o['id']}/accept"
    assert api.post(path, {"kfs_version": o["kfs_version"], "acknowledged": False}).json()["code"] == "kfs_required"
    assert api.post(path, {"kfs_version": "old", "acknowledged": True}).json()["code"] == "kfs_version_mismatch"
    assert api.post(path, {"kfs_version": o["kfs_version"], "acknowledged": True}).json()["state"] == "accepted"
    # mandate, then e-sign
    assert put(api, app, "esign", {"agreement_read": True}).json()["code"] == "step_out_of_order"
    r = put(api, app, "mandate", {"account_holder": "Asha Rao", "account_no": "123456789012", "ifsc": "HDFC0001234",
                                  "mandate_authorisation": True})
    assert r.status_code == 200
    state = api.get(f"/applications/{app['id']}").json()
    assert state["state"] == "mandate_pending" and state["mandate_active"] and state["current_step"] == "esign"
    r = put(api, app, "esign", {"agreement_read": True}).json()
    assert r["redirect"]["provider"] == "esign"
    api.post("/mock/provider/esign/complete", {"application_id": app["id"]})
    done = api.get(f"/applications/{app['id']}").json()
    assert done["state"] == "disbursed" and done["current_step"] == "handoff" and done["vehicle_id"]
    veh = api.get(f"/vehicles/{done['vehicle_id']}").json()
    assert veh["delivery_status"] == "pending" and veh["loan"]["status"] == "active"
    states = [e["state"] for e in api.get(f"/applications/{app['id']}/timeline").json()["items"] if e["state"]]
    assert states == ["consented", "identity_pending", "evidence_pending", "underwriting", "offered", "accepted",
                      "mandate_pending", "signed", "disbursal_pending", "disbursed"]
    # a closed application is read-only
    assert api.post(f"/applications/{app['id']}/cancel").status_code == 409


def test_more_info_loop_with_needs_attention(api):
    api.login("9999900002")
    app = start(api, amount=200000, quote=230000, contribution=30000)
    run_to_underwriting(api, app)
    got = finish(api, app)
    assert got["state"] == "more_info" and got["current_step"] == "remediation"
    reqs = {r["kind"]: r for r in got["requirements"] if r["status"] == "open"}
    assert set(reqs) == {"salary_slip", "address_proof"} and reqs["salary_slip"]["alternatives"]
    # first attempt needs attention -> the loop continues with the new reason
    d = api.upload("salary_slip", "slip_mismatch.pdf", app_id=app["id"], requirement_id=reqs["salary_slip"]["id"])
    assert d["status"] == "needs_attention"
    cur = api.get(f"/applications/{app['id']}").json()
    assert cur["state"] == "more_info" and "name" in [r for r in cur["requirements"] if r["id"] == reqs["salary_slip"]["id"]][0]["reason"]
    # alternatives are accepted: a bank statement satisfies the salary slip requirement
    d = api.upload("bank_statement", "statement.pdf", app_id=app["id"], requirement_id=reqs["salary_slip"]["id"])
    assert d["status"] == "verified"
    assert api.get(f"/applications/{app['id']}").json()["state"] == "more_info"  # address proof still open
    api.upload("address_proof", "bill.pdf", app_id=app["id"], requirement_id=reqs["address_proof"]["id"])
    final = api.get(f"/applications/{app['id']}").json()
    assert final["state"] == "offered"
    assert not [r for r in final["requirements"] if r["status"] == "open"]
    # wrong document kind for the requirement is refused at presign
    r = api.post("/documents/presign", {"kind": "selfie", "mime": "image/png", "size": 5, "sha256": "0" * 64,
                                        "application_id": app["id"], "requirement_id": reqs["address_proof"]["id"]})
    assert r.status_code == 422


def test_declined_path(api):
    api.login("9999900002")
    app = start(api, amount=300000, quote=330000, contribution=30000)
    run_to_underwriting(api, app)
    got = finish(api, app)
    assert got["state"] == "declined" and got["current_step"] == "recovery" and "policy" in got["exit_reason"]
    assert put(api, app, "work", {}).json()["code"] == "application_closed"


def test_kyc_name_mismatch_remediation_blocks_bureau(api):
    api.login("9999900002")
    app = start(api)
    run_to_underwriting(api, app, pan="ABCDE1234X", kyc="video_kyc")
    cur = api.get(f"/applications/{app['id']}").json()
    kinds = {r["kind"] for r in cur["requirements"]}
    assert kinds == {"pan_card", "selfie"} and cur["current_step"] == "remediation"
    assert put(api, app, "bureau", {"bureau_consent": True}).json()["code"] == "requirements_open"
    reqs = {r["kind"]: r for r in cur["requirements"]}
    assert api.upload("pan_card", "pan_blurry.png", app_id=app["id"], requirement_id=reqs["pan_card"]["id"],
                      data=b"\x89PNG\r\n\x1a\n" + b"0" * 20, mime="image/png")["status"] == "rejected"
    from PIL import Image
    import io

    buf = io.BytesIO()
    Image.new("RGB", (64, 64), "white").save(buf, "PNG")
    for kind in ("pan_card", "selfie"):
        d = api.upload(kind, f"{kind}.png", app_id=app["id"], requirement_id=reqs[kind]["id"], data=buf.getvalue(), mime="image/png")
        assert d["status"] == "verified", d
    cur = api.get(f"/applications/{app['id']}").json()
    assert cur["current_step"] == "bureau"
    assert put(api, app, "bureau", {"bureau_consent": True}).status_code == 200


def test_withdrawn_consent_blocks_provider_calls(api):
    api.login("9999900002")
    app = start(api)
    run_to_underwriting(api, app)
    consent = [c for c in api.get("/consents").json()["items"] if c["type"] == "application"][0]
    assert api.post(f"/consents/{consent['id']}/withdraw").status_code == 200
    got = finish(api, app)  # the underwriting job re-checks consent before calling the lender
    assert got["state"] == "cancelled" and "withdrew a consent" in got["exit_reason"]
    assert [e for e in api.get(f"/applications/{app['id']}/timeline").json()["items"] if e["type"] == "provider.lender.decide"] == []


def test_ops_console_is_role_gated_and_masked(api):
    api.login("9999900002")
    app = start(api)
    put(api, app, "identity", {"legal_name": "Asha Rao", "dob": "1995-04-12", "address": "12 MG Road, Pune", "pincode": "411001",
                               "pan": PAN_OK, "employment": "private_salaried", "income": 55000, "existing_emis": 0,
                               "application_consent": True})
    assert api.get("/ops/applications").status_code == 403
    api.post("/auth/logout")
    api.login("9999900009")
    detail = api.get(f"/ops/applications/{app['id']}").json()
    assert "ABCDE" not in str(detail) and detail["consents"] and detail["timeline"]
    assert api.put(f"/ops/applications/{app['id']}", {}).status_code in (404, 405)  # read-only


def test_applications_isolated_between_users(api):
    api.login("9999900002")
    app = start(api)
    api.post("/auth/logout")
    api.login("9999900001")
    assert api.get(f"/applications/{app['id']}").status_code == 404
