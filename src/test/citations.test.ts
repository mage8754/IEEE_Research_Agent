import { describe, expect, it } from "vitest";
import { checkCitations } from "@/lib/engines/citations";

const TEX = `Prior work \\cite{smith2020, lee2021} studied this.
Further results appear in \\citep[p.~4]{missing2019}.
% \\cite{commented2018}`;

const BIB = `@article{smith2020, author={A. Smith}, title={T1}, journal={J}, year={2020}}
@inproceedings{lee2021, author={B. Lee}, title={T2}, booktitle={Conf}, year={2021}}
@article{unused2017, author={C. Unused}, title={T3}, journal={J}, year={2017}}
@article{smith2020, author={A. Smith}, title={Dup}, journal={J}, year={2020}}
@article{noyear2022, author={D}, title={T4}, journal={J}}`;

describe("Citation consistency", () => {
  const report = checkCitations(TEX, BIB);

  it("detects every citation key, including multi-key cites", () => {
    expect(report.citedKeys.map((c) => c.key).sort()).toEqual(["lee2021", "missing2019", "smith2020"]);
  });

  it("ignores citations in commented-out lines", () => {
    expect(report.citedKeys.find((c) => c.key === "commented2018")).toBeUndefined();
  });

  it("flags cited keys that have no BibTeX entry", () => {
    expect(report.missing.map((m) => m.key)).toEqual(["missing2019"]);
  });

  it("flags BibTeX entries never cited", () => {
    expect(report.unused.map((u) => u.key).sort()).toEqual(["noyear2022", "unused2017"]);
  });

  it("flags duplicate keys and entries missing required fields", () => {
    expect(report.duplicates.map((d) => d.key)).toEqual(["smith2020"]);
    expect(report.incomplete.find((i) => i.key === "noyear2022")?.missingFields).toEqual(["year"]);
  });
});
