import re


PASSWORD_RULE_MESSAGE = (
    "Password must be at least 6 characters and include uppercase, lowercase, "
    "number, and symbol"
)


def validate_password_complexity(password: str) -> str:
    if len(password) < 6:
        raise ValueError(PASSWORD_RULE_MESSAGE)
    if not re.search(r"[A-Z]", password):
        raise ValueError(PASSWORD_RULE_MESSAGE)
    if not re.search(r"[a-z]", password):
        raise ValueError(PASSWORD_RULE_MESSAGE)
    if not re.search(r"\d", password):
        raise ValueError(PASSWORD_RULE_MESSAGE)
    if not re.search(r"[^A-Za-z0-9\s]", password):
        raise ValueError(PASSWORD_RULE_MESSAGE)
    return password
