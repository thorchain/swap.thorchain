const decimal = (0.1).toLocaleString().replaceAll(/[0-9]+/g, "");

export const priceFormatter = (
  val: bigint,
  options?: { precision?: number; trim?: boolean }
): string => {
  if (val === 0n)
    return `0.0`.padEnd(options?.precision ? options.precision + 1 : 5, "0");
  const size = val.toString().length - 12;
  const decimalTrim = options?.trim === false ? "" : /^(.{2}.*?)(0+)$/;
  const replace = options?.trim === false ? "" : "$1";

  const precision = options?.precision ? options.precision + -size : undefined;

  if (size >= 3) {
    return (
      Number(val.toString().slice(0, size)).toLocaleString() +
      decimal +
      val
        .toString()
        .slice(size, size + 2)
        .replace(decimalTrim, replace)
    );
  }

  if (size > 0) {
    return (
      Number(val.toString().slice(0, size)).toLocaleString() +
      decimal +
      val
        .toString()
        .slice(size, precision ? precision + 1 : size + 3)
        .replace(decimalTrim, replace)
    );
  }
  if (size > -1) {
    return (
      "0" +
      decimal +
      val
        .toString()
        .slice(0, precision || 3)
        .replace(decimalTrim, replace)
    );
  }

  if (size > -3) {
    return (
      "0" +
      decimal +
      val
        .toString()
        .padStart(12, "0")
        .slice(0, precision || -size + 3)
        .replace(decimalTrim, replace)
    );
  }

  const sub = {
    "0": "\u2080",
    "1": "\u2081",
    "2": "\u2082",
    "3": "\u2083",
    "4": "\u2084",
    "5": "\u2085",
    "6": "\u2086",
    "7": "\u2087",
    "8": "\u2088",
    "9": "\u2089",
  }[-size];

  return (
    "0" +
    decimal +
    "\u0030" +
    sub +
    val
      .toString()
      .padStart(12, "0")
      .slice(-size, -size + (precision || 3))
      .replace(decimalTrim, replace)
  );
};
