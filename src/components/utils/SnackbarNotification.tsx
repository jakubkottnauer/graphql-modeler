import * as React from 'react';
import { Snackbar } from '@material-ui/core';
import MuiAlert from '@material-ui/lab/Alert';

function Alert(props) {
  return <MuiAlert elevation={6} variant="filled" {...props} />;
}

export const SnackbarNotification = ({
  setOpen,
  open,
  text,
}: {
  setOpen: (value: boolean) => void;
  open: boolean;
  text: string;
}) => {
  const handleClose = (_event, reason) => {
    if (reason === 'clickaway') {
      return;
    }

    setOpen(false);
  };

  return (
    <Snackbar open={open} autoHideDuration={3000} onClose={handleClose}>
      <Alert onClose={handleClose} severity="warning">
        {text}
      </Alert>
    </Snackbar>
  );
};
