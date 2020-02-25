import * as React from 'react';
import Snackbar from '@material-ui/core/Snackbar';
import Alert from '@material-ui/lab/Alert';
import IconButton from '@material-ui/core/IconButton';
import Typography from '@material-ui/core/Typography';
import CloseIcon from '@material-ui/icons/Close';

const shortcuts = [
  ['s', 'New setting'],
  ['u', 'New union'],
  ['a', 'Add attribute to selected setting'],
  ['c', 'Clone selected setting/union'],
  ['e', 'Edit selected setting/union'],
];

const shorcutStyle: any = {
  borderRadius: 3,
  border: '1px solid lightgray',
  display: 'inline-block',
  minWidth: 18,
  height: 20,
  textAlign: 'center',
  backgroundColor: 'WhiteSmoke',
  padding: '0 2px',
};

const Message = () => (
  <>
    <Typography variant="h6">Did you know...</Typography>
    <Typography variant="subtitle2" gutterBottom>
      ...that we now have a bunch of handy shortcuts?
    </Typography>
    <Typography variant="body1" gutterBottom>
      {shortcuts.map(([shortcut, description]) => (
        <p key={shortcut}>
          <span style={shorcutStyle}>{shortcut}</span>
          &nbsp;
          {description}
        </p>
      ))}
      <p>
        <span style={shorcutStyle}>d</span>
        &nbsp;or&nbsp;
        <span style={shorcutStyle}>Del</span>
        &nbsp; Delete selected setting/union
      </p>
      <p>
        When editing, press <span style={shorcutStyle}>enter</span> to save or{' '}
        <span style={shorcutStyle}>esc</span> to cancel.
      </p>
    </Typography>
  </>
);

export const ShortcutsNotification = () => {
  const lsKey = 'disableShortcutNotif';
  const [isOpen, setIsOpen] = React.useState(!localStorage.getItem(lsKey));
  const close = () => {
    setIsOpen(false);
    localStorage.setItem(lsKey, 'true');
  };
  return (
    <Snackbar
      anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
      open={isOpen}
      message={<Message />}
    >
      <Alert
        severity="info"
        onClose={close}
        action={
          <IconButton size="small" aria-label="close" color="inherit" onClick={close}>
            <CloseIcon fontSize="small" />
          </IconButton>
        }
      >
        <Message />
      </Alert>
    </Snackbar>
  );
};
