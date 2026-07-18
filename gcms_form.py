"""IMM 5744 (Consent for an Access to Information Request) auto-fill.

Fills the official IRCC template (templates/imm5744e.pdf) with the order's applicant
+ related-person details and our Designated Representative info, then FLATTENS the
result (Document.bake). Flattening matters: the template is a hybrid XFA/AcroForm
LiveCycle PDF — filled AcroForm values are invisible in Adobe Reader unless the XFA
layer is removed, and baking the values into page content sidesteps every viewer
quirk at once. The user just prints, signs in blue ink, and scans.

Signature / date cells are intentionally left blank: IRCC only accepts original
handwritten signatures in blue ink (form page 2).
"""
import os
import io
import datetime

import fitz  # PyMuPDF

def _today_toronto() -> str:
    """Generation date for the signature-date cells (Toronto time when tzdata is available)."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.datetime.now(ZoneInfo("America/Toronto")).strftime("%Y-%m-%d")
    except Exception:  # no tzdata (e.g. bare Windows) — local date is close enough
        return datetime.date.today().isoformat()

TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "templates", "imm5744e.pdf")
BSF745_PATH = os.path.join(os.path.dirname(__file__), "templates", "bsf745e.pdf")

# ── Section 1: Designated Representative (who files the ATIP request) ──────────
# Configure via env on Render; defaults make missing config obvious on the PDF.
def _dr_info() -> dict:
    return {
        "family_name": os.getenv("GCMS_DR_FAMILY_NAME", "Yildirim"),
        "given_name": os.getenv("GCMS_DR_GIVEN_NAME", "Taner"),
        "firm": os.getenv("GCMS_DR_FIRM", "Mentor Visa"),
        "address": os.getenv("GCMS_DR_ADDRESS", "1112 Avenue Rd"),
        "city": os.getenv("GCMS_DR_CITY", "Toronto"),
        "province": os.getenv("GCMS_DR_PROVINCE", "ON"),
        "country": os.getenv("GCMS_DR_COUNTRY", "Canada"),
        "postal_code": os.getenv("GCMS_DR_POSTAL_CODE", "M5N 2E3"),
        "phone": os.getenv("GCMS_DR_PHONE", "647 948 3372"),
        "other_phone": os.getenv("GCMS_DR_OTHER_PHONE", ""),
        "email": os.getenv("GCMS_DR_EMAIL", "info@mentorvisa.com"),
    }


def dr_configured() -> bool:
    d = _dr_info()
    return bool(d["family_name"] and d["address"] and d["city"])


# ── Field map (XFA-style fully-qualified AcroForm names) ────────────────────────
# Mapped by visual position on the rendered form; some internal names are misleading
# (LiveCycle re-used "TelephoneNo" for the City/Province/Country/Postal cells).
_P = "IMM_5744[0].Page1[0]."
_DR1 = _P + "DRI_Sub[0].DRInfoSub1[0]."
_DR2 = _P + "DRI_Sub[0].DRInfoSub2[0]."
_APP = _P + "AppIndividSub[0].AppInfoSub[0]."       # Section 2 — applicant
_REL1 = _P + "AppIndividSub[0].IndividSub[0]."      # Section 2.1
_REL2 = _P + "Individual45Sub[0].Individual4Sub[0]."  # Section 2.2
_REL3 = _P + "Individual45Sub[0].Individual5Sub[0]."  # Section 2.3

# Related-individual blocks: (family, given, dob, relationship, signature_date) field names.
_REL_BLOCKS = [
    (_REL1 + "Family_name[0]", _REL1 + "Given_name[0]", _REL1 + "Firm[0]",  # 'Firm' cell is visually the 2.1 DOB box
     _REL1 + "RelationShip[0]", _REL1 + "signature[0].SignatureDate[0]"),
    (_REL2 + "Family_name[0]", _REL2 + "Given_name[0]", _REL2 + "DateBirth[0]",
     _REL2 + "TelephoneSub[0].RelationShip[0]", _REL2 + "signature[0].SignatureDate[0]"),
    (_REL3 + "Family_name[0]", _REL3 + "Given_name[0]", _REL3 + "DateBirth[0]",
     _REL3 + "TelephoneSub[0].RelationShip[0]", _REL3 + "signature[0].SignatureDate[0]"),
]

MAX_RELATED = len(_REL_BLOCKS)  # form fits applicant + 3 (page 2: "Up to four people")


def fill_imm5744(order) -> bytes:
    """Return a filled + flattened IMM 5744 PDF for a GCMSOrder. Raises on template issues."""
    dr = _dr_info()
    values = {
        # Section 1 — designated representative
        _DR1 + "Family_name[0]": dr["family_name"],
        _DR1 + "Given_name[0]": dr["given_name"],
        _DR1 + "Firm[0]": dr["firm"],
        _DR1 + "TelephoneSub[0].TelephoneNo[0]": dr["phone"],
        _DR1 + "TelephoneSub[0].otherTelephoneNo[0]": dr["other_phone"],
        _DR2 + "Address[0]": dr["address"],
        _DR2 + "CityProv[0].otherTelephoneNo[0]": dr["city"],          # City cell
        _DR2 + "CityProv[0].TelephoneNo[0]": dr["province"],           # Province cell
        _DR2 + "CountryPostalCode[0].TelephoneNo[0]": dr["country"],   # Country cell
        _DR2 + "CountryPostalCode[0].otherTelephoneNo[0]": dr["postal_code"],  # Postal cell
        _DR2 + "EmailAddress[0]": dr["email"],
        # Section 2 — applicant. Signature stays blank (handwritten blue ink only);
        # the DATE cell is pre-filled with the generation date so IRCC gets a dated consent.
        _APP + "Family_name[0]": (order.family_name or order.full_name or "").strip(),
        _APP + "Given_name[0]": (order.given_name or "").strip(),
        _APP + "DateBirth[0]": order.date_of_birth or "",
        _APP + "signature[0].SignatureDate[0]": _today_toronto(),
    }

    related = (order.related_persons or [])[:MAX_RELATED]
    for person, (f_fam, f_giv, f_dob, f_rel, f_sigdate) in zip(related, _REL_BLOCKS):
        values[f_fam] = (person.get("family_name") or "").strip()
        values[f_giv] = (person.get("given_name") or "").strip()
        values[f_dob] = (person.get("date_of_birth") or "").strip()
        rel = (person.get("relationship") or "").strip()
        if person.get("under_16"):
            rel = (rel + " (under 16 — parents sign)").strip()
        values[f_rel] = rel
        values[f_sigdate] = _today_toronto()  # date next to each signature = generation date

    return _fill_and_bake(TEMPLATE_PATH, values, order, "IMM 5744", len(related))


def _fill_and_bake(template_path: str, values: dict, order, label: str, n_related: int,
                   checkboxes: dict | None = None) -> bytes:
    """Fill AcroForm widgets (text + checkboxes) and flatten to plain page content."""
    doc = fitz.open(template_path)
    filled = 0
    for page in doc:
        for w in page.widgets() or []:
            name = w.field_name
            if checkboxes and name in checkboxes:
                w.field_value = True  # PyMuPDF resolves the widget's own on-state
                w.update()
                filled += 1
            elif name in values and values[name]:
                w.field_value = values[name]
                w.update()
                filled += 1
    doc.bake(annots=True, widgets=True)
    buf = io.BytesIO()
    doc.save(buf, garbage=3, deflate=True)
    doc.close()
    print(f"[GCMS] {label} generated for order #{order.id}: {filled} fields filled, "
          f"{n_related} related person(s), DR configured={dr_configured()}")
    return buf.getvalue()


# ── BSF745 (CBSA — Authority to Release Personal Information) ──────────────────
# Sec 2 = designated individual (us), Sec 3 = requester, Sec 4-6 = other individuals.
# Signing age on this form is 18+ (dependent children under 18 are covered by the
# requester's consent). "Consent1" checkboxes pick the consent scope: '/1' = release to
# the designated individual only (privacy-conservative default), '/2' = to their firm.
_B1 = "topmostSubform[0].Page1[0]."
_B2 = "topmostSubform[0].Page2[0]."
_BSF_OTHER_BLOCKS = [  # (prefix, has-relationship) for sections 4, 5, 6
    _B1 + "Four_", _B2 + "Five_", _B2 + "Six_",
]
BSF_MAX_RELATED = len(_BSF_OTHER_BLOCKS)


def fill_bsf745(order) -> bytes:
    """Filled + flattened BSF745 for a CBSA-notes order. Signature cells stay blank."""
    dr = _dr_info()
    values = {
        # Section 2 — designated individual (and firm, informational)
        _B1 + "Two_NomdeFamille[0]": dr["family_name"],
        _B1 + "Two_Prenom[0]": dr["given_name"],
        _B1 + "Two_Adresse[0]": dr["address"],
        _B1 + "Two_Ville[0]": dr["city"],
        _B1 + "Two_Province[0]": dr["province"],
        _B1 + "Two_Pays[0]": dr["country"],
        _B1 + "Two_CodePostal[0]": dr["postal_code"],
        _B1 + "Two_Entreprise[0]": dr["firm"],
        _B1 + "Two_AddCourriel[0]": dr["email"],
        _B1 + "Two_Telephone[0]": dr["phone"],
        _B1 + "Two_AutreTelephone[0]": dr["other_phone"],
        # Section 3 — requester (signature blank; date pre-filled like IMM 5744)
        _B1 + "Three_NomdeFamille[0]": (order.family_name or order.full_name or "").strip(),
        _B1 + "Three_Prenom[0]": (order.given_name or "").strip(),
        _B1 + "Three_DateNaissance[0]": order.date_of_birth or "",
        _B1 + "Three_NumeroClient[0]": (order.uci or "").strip(),
        _B1 + "Three_SigDate[0]": _today_toronto(),
    }
    checkboxes = {_B1 + "Three_Consent1[0]": "/1"}  # release to designated individual only

    related = (order.related_persons or [])[:BSF_MAX_RELATED]
    for person, prefix in zip(related, _BSF_OTHER_BLOCKS):
        values[prefix + "NomdeFamille[0]"] = (person.get("family_name") or "").strip()
        values[prefix + "Prenom[0]"] = (person.get("given_name") or "").strip()
        values[prefix + "DateNaissance[0]"] = (person.get("date_of_birth") or "").strip()
        values[prefix + "Lien[0]"] = (person.get("relationship") or "").strip()
        values[prefix + "SigDate[0]"] = _today_toronto()
        checkboxes[prefix + "Consent1[0]"] = "/1"

    return _fill_and_bake(BSF745_PATH, values, order, "BSF745", len(related), checkboxes)


def fill_consent_form(order):
    """Dispatch by notes type: CBSA orders get BSF745, IRCC orders get IMM 5744.
    Returns (pdf_bytes, form_code)."""
    if (order.notes_type or "ircc") == "cbsa":
        return fill_bsf745(order), "BSF745"
    return fill_imm5744(order), "IMM5744"
