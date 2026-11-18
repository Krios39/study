export interface XmlNode {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

export class Xml {
  static parse(text: string): XmlNode {
    const root: XmlNode = { name: "#document", attributes: {}, children: [], text: "" };
    const stack: XmlNode[] = [root];
    const decode = (value: string) =>
      value.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, code: string) => {
        if (code[0] !== "#") return ENTITIES[code] ?? whole;
        return String.fromCodePoint(code[1] === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10));
      });
    let position = text.charCodeAt(0) === 0xfeff ? 1 : 0;
    while (position < text.length) {
      const open = text.indexOf("<", position);
      const top = stack[stack.length - 1];
      if (open < 0) break;
      if (open > position) top.text += decode(text.slice(position, open));
      if (text.startsWith("<!--", open)) {
        position = text.indexOf("-->", open) + 3;
        continue;
      }
      if (text.startsWith("<![CDATA[", open)) {
        const end = text.indexOf("]]>", open);
        top.text += text.slice(open + 9, end);
        position = end + 3;
        continue;
      }
      const close = text.indexOf(">", open);
      if (close < 0) throw new Error("XML: unclosed tag");
      const body = text.slice(open + 1, close);
      position = close + 1;
      if (body[0] === "?" || body[0] === "!") continue;
      if (body[0] === "/") {
        const name = body.slice(1).trim();
        if (stack.length < 2 || top.name !== name) throw new Error(`XML: unexpected </${name}>`);
        top.text = top.text.trim();
        stack.pop();
        continue;
      }
      const selfClosing = body.endsWith("/");
      const inner = selfClosing ? body.slice(0, -1) : body;
      const match = /^([^\s]+)/.exec(inner);
      if (!match) throw new Error("XML: empty tag");
      const node: XmlNode = { name: match[1], attributes: {}, children: [], text: "" };
      const attribute = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
      for (let found = attribute.exec(inner); found; found = attribute.exec(inner)) {
        node.attributes[found[1]] = decode(found[3] ?? found[4] ?? "");
      }
      top.children.push(node);
      if (!selfClosing) stack.push(node);
    }
    if (stack.length !== 1) throw new Error(`XML: <${stack[stack.length - 1].name}> is not closed`);
    return root;
  }

  static child(node: XmlNode | undefined, name: string): XmlNode | undefined {
    return node?.children.find((child) => child.name === name);
  }

  static all(node: XmlNode | undefined, name: string): XmlNode[] {
    return node?.children.filter((child) => child.name === name) ?? [];
  }

  static text(node: XmlNode | undefined, name: string): string {
    return Xml.child(node, name)?.text ?? "";
  }

  static references(node: XmlNode | undefined, wrapper: string, tag: string): string[] {
    return Xml.all(Xml.child(node, wrapper), tag).map((item) => item.attributes.Reference);
  }
}
