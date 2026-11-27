import sys

from pyspark.sql import SparkSession

LAST_NAME, FIRST_NAME, BALANCE, ADDRESS, CITY, LAST_TRANS, BANK = range(7)
BLANK = "(blank)"


def clean(value):
    text = (value or "").strip().upper()
    return text if text else BLANK


def balance_stats(group):
    key, values = group
    balances = sorted(values)
    count = len(balances)
    return (key, {
        "count": count,
        "avg": sum(balances) / count,
        "min": balances[0],
        "max": balances[-1],
        "top3_high": balances[::-1][:3],
        "top3_low": balances[:3],
    })


def analyse(rdd, key_fn):
    return (rdd.map(lambda t: (key_fn(t), t[BALANCE]))
               .groupByKey()
               .map(balance_stats)
               .sortByKey())


def key_text(key):
    return " | ".join(key) if isinstance(key, tuple) else key


def report(title, stats):
    rows = stats.collect()
    print(f"\n=== {title}: {len(rows)} groups ===")
    print("key\tcount\tavg\tmin\tmax\ttop3_high\ttop3_low")
    for key, s in rows:
        print(f"{key_text(key)}\t{s['count']}\t{s['avg']:.2f}\t{s['min']:.2f}\t{s['max']:.2f}\t"
              f"{s['top3_high']}\t{s['top3_low']}")


def year_of(t):
    date = (t[LAST_TRANS] or "").strip()
    return date[-4:] if len(date) == 10 else None


def main():
    if len(sys.argv) < 3:
        print("Usage: sparkBankAccounts.py input_csv year", file=sys.stderr)
        sys.exit(2)
    input_folder, year = sys.argv[1], sys.argv[2]

    spark = SparkSession.builder.appName("SparkBankAccounts").getOrCreate()
    spark.sparkContext.setLogLevel("WARN")

    bank_accounts = (spark.read.option("header", "true").option("inferSchema", "true")
                     .csv(input_folder).rdd.map(lambda x: tuple(x)))
    bank_accounts = bank_accounts.filter(lambda t: t[BALANCE] is not None).cache()

    print("first 3 records:", bank_accounts.take(3))
    print("records:", bank_accounts.count())

    by_city = lambda t: clean(t[CITY])
    by_city_bank = lambda t: (clean(t[CITY]), clean(t[BANK]))

    report("1. Balance by City", analyse(bank_accounts, by_city))
    report("2. Balance by (City, Bank)", analyse(bank_accounts, by_city_bank))

    in_year = bank_accounts.filter(lambda t: year_of(t) == year)
    print(f"\nrecords with last transaction in {year}:", in_year.count())
    report(f"3a. Balance by City, last transaction in {year}", analyse(in_year, by_city))
    report(f"3b. Balance by (City, Bank), last transaction in {year}", analyse(in_year, by_city_bank))

    spark.stop()


if __name__ == "__main__":
    main()
