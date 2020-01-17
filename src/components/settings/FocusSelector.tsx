import * as React from 'react';
import * as _ from 'lodash';
import { isNode, getDefaultRoot } from '../../graph';

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
    const rootType = this.props.rootType || getDefaultRoot(schema);

    const rootTypeNames = getRootTypeNames(schema);
    const rootSubTypeNames = getRootSubTypeNames(schema);
    const otherTypeNames = Object.keys(schema.types)
      .map(id => schema.types[id])
      .filter(type => isNode(type) && !!type.fields.id)
      .map(type => type.name)
      .filter(name => rootTypeNames.indexOf(name) === -1 && rootSubTypeNames.indexOf(name) === -1)
      .sort();
    return (
      <>
        <FormLabel>Focus on &nbsp;</FormLabel>
        <Select onChange={handleChange} value={rootType}>
          {[...rootTypeNames, ...rootSubTypeNames].map(name => (
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
        onChange(newRootType === getDefaultRoot(schema) ? undefined : newRootType);
      }
    }
  }
}

function getRootTypeNames(schema) {
  let { queryType, mutationType, subscriptionType } = schema;
  const names = [];
  if (queryType) {
    names.push(queryType.name);
  }
  if (mutationType) {
    names.push(mutationType.name);
  }
  if (subscriptionType) {
    names.push(subscriptionType.name);
  }
  return names;
}

function getRootSubTypeNames(schema) {
  let { queryType } = schema;
  const names = [];
  for (const field of Object.values<any>(queryType.fields)) {
    names.push(field.type.name);
  }

  return _.uniq(names);
}
