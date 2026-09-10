#!/usr/bin/env python3
"""A very small tolerant HTML tree, on the standard library only.

`analyze_served.py` and `crawl.py` need roughly a dozen queries against served
HTML: title, a few `<meta>` and `<link>` tags, headings, images, anchors,
JSON-LD script bodies, a breadcrumb container and the main text. BeautifulSoup
plus lxml would do it, but neither is present on a stock Mac running Claude
Code, and an install step that fails halfway through a scan is worse than a
parser we control. So: `html.parser` (which already handles character
references and raw `<script>`/`<style>` bodies for us) plus a stack that
tolerates the mis-nesting real pages contain.

Deliberately not a DOM and not a CSS engine. `find`/`find_all` take a tag name
and an attribute predicate; anything more selective is the caller's job.
"""

from html.parser import HTMLParser

# Elements that never have a closing tag, so they must not open a scope.
VOID = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr",
}

# Elements whose open scope a new start tag implicitly closes. A page with
# `<li>a<li>b` must not nest the second item inside the first, or the
# breadcrumb labels come back concatenated.
IMPLIED_END = {
    "li": {"li"},
    "p": {"p"},
    "dt": {"dt", "dd"},
    "dd": {"dt", "dd"},
    "tr": {"tr", "td", "th"},
    "td": {"td", "th"},
    "th": {"td", "th"},
    "option": {"option"},
    "thead": {"thead", "tbody", "tfoot"},
    "tbody": {"thead", "tbody", "tfoot"},
    "tfoot": {"thead", "tbody", "tfoot"},
}

# Their text is code or fallback markup, never page copy.
NON_TEXT = {"script", "style", "template", "noscript"}


class Node:
    """One element. `tag` is None for the synthetic root."""

    __slots__ = ("tag", "attrs", "children", "parent")

    def __init__(self, tag, attrs=None, parent=None):
        self.tag = tag
        self.attrs = attrs or {}
        self.children = []  # Node | str
        self.parent = parent

    def get(self, name, default=None):
        return self.attrs.get(name, default)

    def __repr__(self):  # pragma: no cover - debugging aid
        return f"<{self.tag} {self.attrs}>"

    # -- traversal ---------------------------------------------------------

    def descendants(self):
        for child in self.children:
            if isinstance(child, Node):
                yield child
                yield from child.descendants()

    def find_all(self, tag=None, attrs=None, match=None):
        """Every descendant matching `tag`, every key/value in `attrs`, and `match`.

        An `attrs` value may be a string (exact match), True (attribute
        present and non-empty) or a callable taking the raw value.
        """
        out = []
        for node in self.descendants():
            if tag is not None and node.tag != tag:
                continue
            if attrs and not _attrs_match(node, attrs):
                continue
            if match is not None and not match(node):
                continue
            out.append(node)
        return out

    def find(self, tag=None, attrs=None, match=None):
        for node in self.find_all(tag, attrs, match):
            return node
        return None

    # -- text --------------------------------------------------------------

    def strings(self):
        if self.tag in NON_TEXT:
            return
        for child in self.children:
            if isinstance(child, str):
                yield child
            else:
                yield from child.strings()

    def get_text(self, separator=" ", strip=True):
        parts = [s.strip() if strip else s for s in self.strings()]
        if strip:
            parts = [p for p in parts if p]
        return separator.join(parts)

    def raw_text(self):
        """Concatenated character data, including inside script/style.

        Used for JSON-LD bodies, where `get_text` deliberately returns nothing.
        """
        out = []
        for child in self.children:
            if isinstance(child, str):
                out.append(child)
            else:
                out.append(child.raw_text())
        return "".join(out)


def _attrs_match(node, attrs):
    for key, want in attrs.items():
        have = node.attrs.get(key)
        if want is True:
            if not have:
                return False
        elif callable(want):
            if not want(have):
                return False
        elif have != want:
            return False
    return True


class _Builder(HTMLParser):
    def __init__(self):
        # convert_charrefs=True gives us decoded text in handle_data, which is
        # what every caller wants; the only place we need the raw bytes is the
        # JSON-LD body, and character references are illegal there anyway.
        super().__init__(convert_charrefs=True)
        self.root = Node(None)
        self.stack = [self.root]

    def _close_through(self, tag):
        """Pop back to and including the nearest open `tag`; no-op if unopened."""
        for depth in range(len(self.stack) - 1, 0, -1):
            if self.stack[depth].tag == tag:
                del self.stack[depth:]
                return

    def handle_starttag(self, tag, attrs):
        for closes in (IMPLIED_END.get(tag) or ()):
            if self.stack[-1].tag == closes:
                self.stack.pop()
        node = Node(tag, {k: (v if v is not None else "") for k, v in attrs}, self.stack[-1])
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        node = Node(tag, {k: (v if v is not None else "") for k, v in attrs}, self.stack[-1])
        self.stack[-1].children.append(node)

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        self._close_through(tag)

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def parse(markup):
    """Parse bytes or str into a root Node. Never raises on bad markup."""
    if isinstance(markup, bytes):
        markup = markup.decode("utf-8", errors="replace")
    builder = _Builder()
    builder.feed(markup)
    builder.close()
    return builder.root
