CONFIDENCE_POLICY = {
    "auto_apply": 0.98,
    "auto_generate_validate": 0.90,
    "review": 0.75,
    "ambiguous": 0.50,
    "block": 0.00,
}


def decision_for(confidence: float) -> str:
    if confidence >= CONFIDENCE_POLICY["auto_apply"]:
        return "AUTO_APPLY"
    if confidence >= CONFIDENCE_POLICY["auto_generate_validate"]:
        return "AUTO_GENERATE_VALIDATE"
    if confidence >= CONFIDENCE_POLICY["review"]:
        return "REVIEW"
    if confidence >= CONFIDENCE_POLICY["ambiguous"]:
        return "AMBIGUOUS"
    return "BLOCK"

