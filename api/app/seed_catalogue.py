"""Seeded demo catalogue (~60 Indian models). Prices are illustrative ex-showroom ranges, not a licensed feed."""
from datetime import date

from sqlalchemy.orm import Session

from .models import CatalogueModel

# (type, make, model, variant, segment, price_low, price_high, specs)
S = "scooter"
B = "bike"
C = "car"
_ROWS = [
    # scooters
    (S, "Honda", "Activa 6G", "STD", "commute", 78000, 86000, dict(cc=109, bhp=7.8, eff="50 kmpl")),
    (S, "Suzuki", "Access 125", "Disc", "commute", 82000, 98000, dict(cc=124, bhp=8.3, eff="52 kmpl")),
    (S, "TVS", "Jupiter 125", "SmartXonnect", "commute", 82000, 96000, dict(cc=124, bhp=8.0, eff="50 kmpl")),
    (S, "Yamaha", "Fascino 125", "Hybrid", "commute", 80000, 93000, dict(cc=125, bhp=8.2, eff="55 kmpl")),
    (S, "Hero", "Destini 125", "VX", "commute", 78000, 90000, dict(cc=124, bhp=9.0, eff="50 kmpl")),
    (S, "Suzuki", "Burgman Street", "125", "touring", 95000, 112000, dict(cc=124, bhp=8.6, eff="50 kmpl")),
    (S, "Vespa", "SXL 150", "Standard", "touring", 130000, 155000, dict(cc=149, bhp=10.4, eff="45 kmpl")),
    (S, "Yamaha", "Aerox 155", "Version S", "performance", 150000, 170000, dict(cc=155, bhp=15.0, eff="42 kmpl")),
    (S, "Aprilia", "SR 160", "Standard", "performance", 125000, 140000, dict(cc=160, bhp=10.9, eff="40 kmpl")),
    (S, "Ather", "450X", "Gen 3", "ev", 125000, 160000, dict(range="146 km", bhp=6.4)),
    (S, "Ola", "S1 X", "3 kWh", "ev", 80000, 105000, dict(range="151 km", bhp=8.5)),
    (S, "TVS", "iQube", "S", "ev", 105000, 140000, dict(range="100 km", bhp=4.4)),
    (S, "Bajaj", "Chetak", "Urbane", "ev", 115000, 135000, dict(range="113 km", bhp=5.4)),
    # commuter / roadster bikes
    (B, "Hero", "Splendor+", "Self", "commute", 76000, 82000, dict(cc=97, bhp=8.0, eff="70 kmpl")),
    (B, "Honda", "Shine 125", "Disc", "commute", 82000, 90000, dict(cc=124, bhp=10.7, eff="60 kmpl")),
    (B, "Bajaj", "Platina 110", "ABS", "commute", 70000, 78000, dict(cc=115, bhp=8.4, eff="70 kmpl")),
    (B, "TVS", "Raider 125", "SmartXonnect", "commute", 88000, 100000, dict(cc=124, bhp=11.4, eff="57 kmpl")),
    (B, "Honda", "SP 160", "Twin Disc", "commute", 118000, 125000, dict(cc=162, bhp=13.3, eff="55 kmpl")),
    (B, "Bajaj", "Pulsar N160", "Dual ABS", "performance", 135000, 150000, dict(cc=165, bhp=16.0, eff="45 kmpl")),
    (B, "TVS", "Apache RTR 160 4V", "Dual Disc", "performance", 120000, 135000, dict(cc=160, bhp=17.3, eff="45 kmpl")),
    (B, "Yamaha", "R15 V4", "Standard", "performance", 182000, 197000, dict(cc=155, bhp=18.4, eff="40 kmpl")),
    (B, "KTM", "Duke 200", "Standard", "performance", 195000, 205000, dict(cc=199, bhp=25.0, eff="35 kmpl")),
    (B, "KTM", "Duke 390", "Gen 3", "performance", 300000, 320000, dict(cc=399, bhp=44.0, eff="28 kmpl")),
    (B, "TVS", "Apache RR 310", "BTO", "performance", 270000, 300000, dict(cc=312, bhp=34.0, eff="30 kmpl")),
    (B, "Triumph", "Speed 400", "Standard", "performance", 240000, 255000, dict(cc=398, bhp=40.0, eff="30 kmpl")),
    (B, "Bajaj", "Dominar 400", "Standard", "touring", 230000, 245000, dict(cc=373, bhp=39.4, eff="27 kmpl")),
    (B, "Royal Enfield", "Hunter 350", "Metro", "touring", 150000, 175000, dict(cc=349, bhp=20.2, eff="36 kmpl")),
    (B, "Royal Enfield", "Classic 350", "Signals", "touring", 193000, 225000, dict(cc=349, bhp=20.2, eff="35 kmpl")),
    (B, "Royal Enfield", "Meteor 350", "Fireball", "touring", 205000, 230000, dict(cc=349, bhp=20.2, eff="35 kmpl")),
    (B, "Honda", "CB350", "H'ness DLX", "touring", 210000, 225000, dict(cc=348, bhp=20.8, eff="35 kmpl")),
    (B, "Jawa", "42", "Dual Tone", "touring", 175000, 200000, dict(cc=294, bhp=27.0, eff="33 kmpl")),
    (B, "Royal Enfield", "Interceptor 650", "Standard", "touring", 303000, 340000, dict(cc=648, bhp=47.0, eff="25 kmpl")),
    (B, "Royal Enfield", "Super Meteor 650", "Astral", "touring", 364000, 395000, dict(cc=648, bhp=47.0, eff="22 kmpl")),
    (B, "Royal Enfield", "Himalayan 450", "Summit", "adventure", 285000, 300000, dict(cc=452, bhp=40.0, eff="30 kmpl")),
    (B, "KTM", "390 Adventure", "X", "adventure", 280000, 365000, dict(cc=399, bhp=43.5, eff="28 kmpl")),
    (B, "Hero", "Xpulse 200 4V", "Pro", "adventure", 150000, 165000, dict(cc=199, bhp=19.0, eff="38 kmpl")),
    (B, "Yezdi", "Adventure", "Standard", "adventure", 215000, 230000, dict(cc=334, bhp=29.0, eff="30 kmpl")),
    (B, "Triumph", "Scrambler 400 X", "Standard", "adventure", 263000, 275000, dict(cc=398, bhp=40.0, eff="30 kmpl")),
    (B, "BMW", "G 310 GS", "Standard", "adventure", 350000, 375000, dict(cc=313, bhp=34.0, eff="30 kmpl")),
    (B, "Revolt", "RV400", "Standard", "ev", 135000, 150000, dict(range="150 km", bhp=5.4)),
    (B, "Ultraviolette", "F77", "Recon", "ev", 300000, 380000, dict(range="323 km", bhp=38.0)),
    (B, "Oben", "Rorr", "Standard", "ev", 100000, 125000, dict(range="187 km", bhp=10.0)),
    # cars
    (C, "Maruti Suzuki", "Alto K10", "VXi", "commute", 400000, 600000, dict(cc=998, bhp=65, eff="24 kmpl")),
    (C, "Maruti Suzuki", "Swift", "ZXi", "commute", 650000, 900000, dict(cc=1197, bhp=82, eff="24 kmpl")),
    (C, "Hyundai", "i20", "Asta", "commute", 740000, 1150000, dict(cc=1197, bhp=83, eff="20 kmpl")),
    (C, "Tata", "Punch", "Accomplished", "commute", 600000, 1000000, dict(cc=1199, bhp=87, eff="20 kmpl")),
    (C, "Honda", "City", "ZX", "touring", 1190000, 1620000, dict(cc=1498, bhp=119, eff="18 kmpl")),
    (C, "Hyundai", "Creta", "SX", "touring", 1100000, 2000000, dict(cc=1497, bhp=113, eff="17 kmpl")),
    (C, "Toyota", "Innova Hycross", "VX", "touring", 1900000, 3100000, dict(cc=1987, bhp=183, eff="21 kmpl")),
    (C, "Mahindra", "Thar", "LX 4x4", "adventure", 1150000, 1760000, dict(cc=1997, bhp=150, eff="15 kmpl")),
    (C, "Mahindra", "Scorpio-N", "Z8", "adventure", 1360000, 2450000, dict(cc=2184, bhp=172, eff="14 kmpl")),
    (C, "Maruti Suzuki", "Jimny", "Alpha", "adventure", 1275000, 1450000, dict(cc=1462, bhp=103, eff="16 kmpl")),
    (C, "Volkswagen", "Virtus GT", "1.5 TSI", "performance", 1600000, 1920000, dict(cc=1498, bhp=148, eff="18 kmpl")),
    (C, "Hyundai", "i20 N Line", "N8", "performance", 1000000, 1250000, dict(cc=998, bhp=118, eff="20 kmpl")),
    (C, "Mini", "Cooper S", "3-Door", "performance", 4400000, 4900000, dict(cc=1998, bhp=178, eff="14 kmpl")),
    (C, "Tata", "Nexon EV", "Empowered", "ev", 1250000, 1750000, dict(range="465 km", bhp=143)),
    (C, "Tata", "Punch EV", "Empowered", "ev", 1000000, 1500000, dict(range="421 km", bhp=120)),
    (C, "MG", "Comet EV", "Excite", "ev", 700000, 1000000, dict(range="230 km", bhp=41)),
    (C, "Mahindra", "XUV400", "EL Pro", "ev", 1550000, 1750000, dict(range="456 km", bhp=148)),
]


def slug(make: str, model: str) -> str:
    return (make + "-" + model).lower().replace(" ", "-").replace("+", "plus").replace("'", "")


def seed_catalogue(db: Session) -> int:
    if db.query(CatalogueModel).count():
        return 0
    asof = date(2026, 10, 1)
    for t, make, model, var, seg, lo, hi, specs in _ROWS:
        db.add(CatalogueModel(id=slug(make, model), type=t, make=make, model=model, variant=var, segment=seg,
                              price_low=lo, price_high=hi, specs=specs, as_of=asof))
    db.commit()
    return len(_ROWS)
