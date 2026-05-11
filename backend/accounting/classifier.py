"""Transaction Classifier — matches counterparty names to accounting codes."""
from typing import Optional


def match_counterparty(counterparty: str, rules: list) -> Optional[dict]:
    """Find the best matching rule for a counterparty name.

    Rules are checked in order. First match wins.
    Case-insensitive partial match.
    """
    if not counterparty:
        return None

    cp_lower = counterparty.lower()

    for rule in rules:
        pattern = rule["pattern"].lower()
        if pattern in cp_lower:
            return rule

    return None


def classify_transactions(transactions: list, rules: list) -> dict:
    """Classify a batch of transactions using rules.

    Returns:
        {
            "classified": [...],     # matched transactions
            "unclassified": [...],   # no match
            "stats": {"auto": N, "unclassified": N, "total": N}
        }
    """
    classified = []
    unclassified = []

    for tx in transactions:
        counterparty = tx.get("counterparty", "") or ""
        match = match_counterparty(counterparty, rules)

        if match:
            classified.append({
                **tx,
                "account_code": match["account_code"],
                "matched_pattern": match["pattern"],
                "residence": match.get("residence"),
                "wht_flag": match.get("wht_flag", 0),
            })
        else:
            unclassified.append(tx)

    return {
        "classified": classified,
        "unclassified": unclassified,
        "stats": {
            "auto": len(classified),
            "unclassified": len(unclassified),
            "total": len(transactions),
        }
    }
