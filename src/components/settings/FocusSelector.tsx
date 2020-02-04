import * as React from 'react';
import * as _ from 'lodash';
import { isNode } from '../../graph';

import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormLabel from '@material-ui/core/FormLabel';
import './FocusSelector.css';

interface FocusSelectorProps {
  rootType?: string;
  schema: any;
  onChange: any;
}

export default class FocusSelector extends React.Component<FocusSelectorProps> {
  render() {
    const { schema, onChange } = this.props;

    const rootSubTypeNames = getRootSubTypeNames(schema);
    const otherTypeNames = Object.keys(schema.types)
      .map(id => schema.types[id])
      .filter(type => isNode(type) && !!type.fields.id)
      .map(type => type.name)
      .filter(name => rootSubTypeNames.indexOf(name) === -1)
      .sort();

    const rootType = this.props.rootType || rootSubTypeNames[0];
    return (
      <>
        <FormLabel>Focus on &nbsp;</FormLabel>
        <Select onChange={handleChange} value={rootType}>
          {rootSubTypeNames.map(name => (
            <MenuItem value={name} key={name}>
              <strong>{name}</strong>
            </MenuItem>
          ))}
          {otherTypeNames.map(name => (
            <MenuItem value={name} key={name}>
              {name}
            </MenuItem>
          ))}
        </Select>
      </>
    );

    function handleChange(event) {
      const newRootType = event.target.value;
      if (newRootType !== rootType) {
        onChange(newRootType === rootSubTypeNames[0] ? undefined : newRootType);
      }
    }
  }
}

function getRootSubTypeNames(schema) {
  let { queryType } = schema;
  const realRootName = queryType.description;
  const names = [realRootName];
  const realRoot: any = Object.values(queryType.fields).find(
    (x: any) => x.name === realRootName,
  ) as any;
  for (const field of Object.values<any>(realRoot.type.fields)) {
    if (field.type.kind === 'OBJECT') {
      names.push(field.type.name);
    }
  }

  return _.uniq(names);
}
