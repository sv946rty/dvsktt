# Content

Texts are JSON in Git and are built into static pages. Nothing here is edited by the apps; user data
(corrections, accounts) will live in a database in phase 2.

```
lexicon/                 shared by all chapters
  hanviet.json           character → Hán-Việt reading(s), e.g. "長": "trường/trưởng"
  glossary.json          short glosses shown in the character popover
  variants.json          variant character → normalized form (䧺 → 雄)
dvsktt/                  Đại Việt sử ký toàn thư
  work.json              navigation tree of the whole work (sections, kỷ, reigns)
  dinh/                  Kỷ nhà Đinh (Bản kỷ, quyển 1)
    chapter.json         titles, reigns, years, passage order, source notes
    passages/E01.json …  one file per passage (see below)
    discussions.json     seed threads for "Góp ý sửa" (correction discussions)
    parallel-sources.json
    entities/            V4 Toàn Thư entity database and the entity bridge output
```

## Passage file

| field | meaning |
|---|---|
| `id` | permanent passage id (E01, F12 …). **Never renamed or reused**: links, citations and mentions point at it. |
| `zh` | Classical Chinese. `⚑` marks the next character as doubtful; `〈 〉` enclose small-print notes. |
| `vi` | Vietnamese translation. `\|1b\|` folio break, `{n1}` footnote reference, `⟦ ⟧` translator insertion, `⟨ ⟩` small note of the original. |
| `en` | English draft (AI-assisted, not yet edited). |
| `notes` | Vietnamese footnotes, in `{nN}` order. |
| `groups` | clause alignment: each group lists the matching `zh`, `vi` and `en` segments, in reading order. Segments are substrings of the passage text (whitespace-insensitive). |

Rules:

* Source text is never silently edited. A correction changes the file in a reviewed commit.
* `npm run validate` checks every file against its schema, that each clause group aligns and that every entity mention still lands on its text. CI runs it.

## Entities

`entities/` is copied from the entity pipeline (Reader v4.1 project) unchanged. `reader-entities.json`
is what the apps use: canonical entities, relations and the mentions the bridge placed in this text,
with render offsets. Wikipedia data comes only from `wikipedia-enrichment.json` (accepted mappings;
currently none, the enrichment has not been run).

## Re-importing from the prototype

```bash
node tools/import-prototype.mjs path/to/dvsktt-reader-v4.1
```
