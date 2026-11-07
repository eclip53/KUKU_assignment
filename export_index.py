"""
Convert the LangChain FAISS store (index.faiss + index.pkl) built in the notebook
into two small, dependency-free files the Vercel functions load at runtime:

  data/chunks.json  -> [{"p": pdf_page, "pl": printed_page, "c": chapter, "t": text}]
  data/vectors.bin  -> int8-quantised BAAI/bge-m3 vectors (per-vector scale)

No faiss / langchain / torch needed: the FAISS flat index is parsed directly and the
pickle is read with a restricted unpickler that never imports real classes.
Usage:  python3 -I scripts/export_index.py index.faiss index.pkl data/
"""
import json, pickle, re, struct, sys
import numpy as np

TOC = [  # (first printed page, chapter) from the handbook's table of contents
    (1, "Consumer Protection"), (4, "Copyright Protection"), (11, "Cyber Bullying"),
    (16, "Dowry Harassment"), (21, "Farmers' Rights (PPVFRA)"), (28, "Fishermen's Rights"),
    (34, "Fundamental Duties"), (39, "MGNREGA"), (46, "Maternity Benefit"),
    (50, "Medical Termination of Pregnancy"), (53, "Motor Vehicle Accidents"),
    (60, "Narcotic Drugs (NDPS)"), (63, "National Green Tribunal"),
    (66, "People's Biodiversity Register"), (70, "Plastic Waste Management"),
    (73, "Power of Attorney"), (75, "Prevention of Cruelty to Animals"), (80, "POCSO"),
    (84, "Right to Education"), (88, "Right to Information"), (94, "Right to Legal Aid"),
    (99, "Rights of Persons with Disabilities"), (105, "Rights of Workers"),
    (111, "Senior Citizens' Rights"), (116, "Street Vendors"), (119, "Succession Certificate"),
    (121, "Surrogacy"), (126, "Traffic Rules"), (129, "Urban Local Bodies & Waste"),
    (132, "Victim Compensation Scheme"), (136, "Women's Safety"), (141, "Annex"),
]
PRINTED_OFFSET = 13  # printed page 1 (Consumer Protection) is PDF page 14
NOISE = re.compile(
    r"(pan[- ]india legal literacy and legal awareness programme|legal aid handbook vol\. ?i"
    r"|nlsiu ?\| ?ceera ?\| ?doj|designing innovative solutions for holistic access to justice)",
    re.I,
)

def chapter_for(printed):
    if printed is None:
        return "Front matter"
    name = "Front matter"
    for start, ch in TOC:
        if printed >= start:
            name = ch
    return name

def clean(text):
    text = NOISE.sub(" ", text)
    text = re.sub(r"^\s*[ivx\d]{1,4}\s*$", " ", text, flags=re.M)   # bare page numbers
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\s*\n\s*", "\n", text).strip()
    return text

class _Stub:
    def __setstate__(self, state): self._st = state

class SafeUnpickler(pickle.Unpickler):
    def find_class(self, module, name):
        if module == "copyreg" and name == "_reconstructor":
            return lambda cls, base, state: cls()
        return type(name, (_Stub,), {})   # never import real code

def main(faiss_path, pkl_path, out_dir):
    raw = open(faiss_path, "rb").read()
    assert raw[:4] in (b"IxF2", b"IxFI"), "expected a flat FAISS index"
    d, = struct.unpack("<i", raw[4:8])
    off = 16 + 8 + 8 + 1 + 4
    n, = struct.unpack("<q", raw[off:off + 8]); off += 8
    X = np.frombuffer(raw[off:off + 4 * n], dtype="<f4").reshape(-1, d)

    store, idmap = SafeUnpickler(open(pkl_path, "rb")).load()
    docs = store._st["_dict"]
    out = []
    for i in range(X.shape[0]):
        dd = docs[idmap[i]]._st["__dict__"]
        md = dd["metadata"]
        pdf_page = int(md.get("page", -1)) + 1
        printed = pdf_page - PRINTED_OFFSET if pdf_page - PRINTED_OFFSET >= 1 else None
        label = str(printed) if printed else "front"
        out.append({"p": pdf_page, "pl": label,
                    "c": chapter_for(printed), "t": clean(dd["page_content"])})
    json.dump(out, open(f"{out_dir}/chunks.json", "w"), ensure_ascii=False, separators=(",", ":"))

    scale = np.abs(X).max(axis=1) / 127.0
    Q = np.round(X / scale[:, None]).astype(np.int8)
    with open(f"{out_dir}/vectors.bin", "wb") as f:
        f.write(struct.pack("<ii", X.shape[0], d))
        f.write(scale.astype("<f4").tobytes())
        f.write(Q.tobytes())
    print(f"exported {len(out)} chunks, dim={d}")

if __name__ == "__main__":
    main(*sys.argv[1:4])
