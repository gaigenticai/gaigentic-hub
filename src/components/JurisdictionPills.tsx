const JURISDICTION_MAP: Record<string, { flag: string; label: string }> = {
  IN: { flag: "\u{1F1EE}\u{1F1F3}", label: "India" },
  US: { flag: "\u{1F1FA}\u{1F1F8}", label: "USA" },
  EU: { flag: "\u{1F1EA}\u{1F1FA}", label: "Europe" },
  GB: { flag: "\u{1F1EC}\u{1F1E7}", label: "UK" },
  SG: { flag: "\u{1F1F8}\u{1F1EC}", label: "Singapore" },
  AE: { flag: "\u{1F1E6}\u{1F1EA}", label: "UAE" },
};

interface Props {
  jurisdictions: string | null;
}

export default function JurisdictionPills({ jurisdictions }: Props) {
  if (!jurisdictions) return null;

  let codes: string[] = [];
  try {
    codes = JSON.parse(jurisdictions);
  } catch {
    return null;
  }

  if (codes.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {codes.map((code) => {
        const info = JURISDICTION_MAP[code] || { flag: "\u{1F30D}", label: code };
        return (
          <span
            key={code}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-ink-50 px-2.5 py-1 text-xs font-medium text-ink-600"
          >
            <span className="text-sm">{info.flag}</span>
            {info.label}
          </span>
        );
      })}
    </div>
  );
}
