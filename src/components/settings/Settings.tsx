import * as React from 'react';
import Checkbox from '@material-ui/core/Checkbox';
import FocusSelector from './FocusSelector';
// import RootSelector from './RootSelector';

interface SettingsProps {
  schema: any;
  options: any;
  onChange: (any) => void;
}

export default class Settings extends React.Component<SettingsProps> {
  render() {
    const { schema, options, onChange } = this.props;

    return (
      <div className="menu-content">
        {/* Root selector is currently broken because we treat the first node as the root */}
        {/* <div className="setting-change-root">
          <RootSelector
            schema={schema}
            rootType={options.rootType}
            onChange={rootType => onChange({ rootType })}
          />
        </div> */}
        <div className="setting-change-focus">
          <FocusSelector
            schema={schema}
            rootType={options.focusOn}
            onChange={focusOn => onChange({ focusOn })}
          />
        </div>
        <div className="setting-other-options">
          <Checkbox
            id="sort"
            color="primary"
            checked={!!options.sortByAlphabet}
            onChange={event => onChange({ sortByAlphabet: event.target.checked })}
          />
          <label htmlFor="sort">Alphabetical order</label>
          <Checkbox
            id="showLeafFields"
            color="primary"
            checked={!!options.showLeafFields}
            onChange={event => onChange({ showLeafFields: event.target.checked })}
          />
          <label htmlFor="showLeafFields">Show leaf attributes</label>
        </div>
      </div>
    );
  }
}
