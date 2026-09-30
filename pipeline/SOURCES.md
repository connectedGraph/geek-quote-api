# Source and authorship manifest

This file documents the boundary between material authored or processed by this project and material obtained from upstream sources.

## What this project authors

The following engineering and editorial work is maintained in this repository:

- the corpus extraction and normalization code in `pipeline/scripts/expand_corpus.js`;
- category rules, tag assignment and corpus-pool balancing;
- exact fingerprinting, 2-gram similarity checks and deduplication;
- translation prompts, XML response parsing, batching, rate limiting and checkpointing;
- dataset merging and the canonical bilingual snapshot in `data/quotes_bilingual.json`;
- project-authored and editorially curated seed entries, where the corresponding `source` field identifies an internal editorial label.

The pipeline is original project code. It is not copied from any of the upstream quote repositories.

## Upstream and attributed material

The raw corpus is mixed. Current source labels include:

| Raw input or source label | Role | Attribution status |
| --- | --- | --- |
| `fortune_computers.txt` | Unix and computer-themed fortune corpus | Upstream material; preserve the attributions embedded in the source text |
| `fortune_science.txt` | Science and mathematics fortune corpus | Upstream material; preserve the attributions embedded in the source text |
| `geek_jokes_raw.json` | Community geek-joke collection | Upstream/community material; the exact original URL is not recorded in the current snapshot |
| `fortune-mod/computers`, `fortune-mod/science` | Named source labels in seed data | Upstream attribution retained in item metadata |
| `alkashef/data-science-quotes`, `kbroman/datasciquotes` | Named data-science quote sources | Upstream attribution retained in item metadata |
| `TheJeffDeanFacts`, `Richard Feynman Quotes` and similar labels | Named quote or folklore sources | Upstream attribution retained in item metadata |

The `source`, `source_zh` and `source_en` fields are attribution metadata, not license metadata. A source name alone does not establish redistribution rights. When adding a new upstream source, contributors should record its canonical URL, license or usage terms, and the transformation applied.

## Translation and transformation

The bilingual fields are generated through the project-owned scripts in `pipeline/scripts/`. Translation is a transformation of the input text; it does not transfer ownership of third-party originals to this project. Dataset contributors remain responsible for retaining source attribution and checking the upstream terms before redistribution.

## Contribution rule

New raw sources should include, at minimum:

1. canonical URL or a stable source identifier;
2. author or upstream project, when known;
3. license or redistribution terms, when known;
4. the source field on every derived quote where practical.

If provenance or licensing is uncertain, mark it explicitly and do not describe the material as project-original.
