"""Live adapter shells. Each raises ProviderNotConfigured until FinStack / lender access is confirmed.

Mapping to implement (see PRD "Integration adapters"):
  Kyc -> FinStack KYC (PAN, CKYC, DigiLocker, video KYC)     Bureau -> FinStack bureau connector
  AA  -> FinStack AA / FIU                                   Lender -> partner lender via FinStack
  Mandate -> UPI AutoPay / e-NACH                            Esign -> FinStack e-sign
  Storage -> S3-compatible presigned PUT (boto3)
"""
from .base import ProviderNotConfigured


def _shell(name: str):
    class Live:
        def __getattr__(self, item):
            def _call(*a, **k):
                raise ProviderNotConfigured(f"Live {name} adapter is not configured (set credentials and implement app/adapters/live.py)")
            return _call
    Live.__name__ = f"Live{name}"
    return Live


LiveOtp = _shell("Otp")
LiveValuation = _shell("Valuation")
LiveKyc = _shell("Kyc")
LiveBureau = _shell("Bureau")
LiveAA = _shell("AccountAggregator")
LiveDocumentParser = _shell("DocumentParser")
LiveLender = _shell("Lender")
LiveMandate = _shell("Mandate")
LiveEsign = _shell("Esign")


class S3Storage:
    """S3 / MinIO storage. Requires boto3 and S3_* env vars; kept minimal for the pilot."""

    def __init__(self):
        import boto3  # noqa: PLC0415

        import os

        self.bucket = os.environ["S3_BUCKET"]
        self.s3 = boto3.client("s3", endpoint_url=os.environ.get("S3_ENDPOINT") or None)

    def presign_put(self, *, key, mime, size):
        url = self.s3.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": mime, "ServerSideEncryption": "AES256"},
            ExpiresIn=300,
        )
        return {"url": url, "method": "PUT", "headers": {"Content-Type": mime, "x-amz-server-side-encryption": "AES256"},
                "expires_in": 300}

    def exists(self, key):
        try:
            self.s3.head_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False

    def read(self, key):
        return self.s3.get_object(Bucket=self.bucket, Key=key)["Body"].read()

    def write(self, key, data):
        self.s3.put_object(Bucket=self.bucket, Key=key, Body=data, ServerSideEncryption="AES256")

    def delete(self, key):
        self.s3.delete_object(Bucket=self.bucket, Key=key)
