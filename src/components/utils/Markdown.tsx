import * as React from 'react';
import { HtmlRenderer, Parser } from 'commonmark';

interface MarkdownProps {
  text: string;
  className: string;
  onChange?: (text: string) => void;
  isEditing?: boolean;
}

export default class Markdown extends React.Component<MarkdownProps> {
  renderer: HtmlRenderer;
  parser: Parser;
  constructor(props) {
    super(props);
    this.renderer = new HtmlRenderer({ safe: true });
    this.parser = new Parser();
  }

  shouldComponentUpdate(nextProps) {
    return this.props.text !== nextProps.text || this.props.isEditing !== nextProps.isEditing;
  }

  render() {
    const { text, className, onChange } = this.props;

    if (!text) return null;

    const parsed = this.parser.parse(text);
    const html = this.renderer.render(parsed);

    if (onChange && this.props.isEditing) {
      return <input value={text} onChange={e => onChange(e.currentTarget.value)} />;
    }

    return (
      <div
        className={className}
        dangerouslySetInnerHTML={{ __html: html }}
        onClick={() => {
          if (onChange) {
            this.setState({ isEditing: true });
          }
        }}
      />
    );
  }
}
