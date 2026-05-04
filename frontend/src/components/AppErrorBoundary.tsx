import React from 'react';
import { Box, Paper, Typography } from '@mui/material';

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : 'Unknown runtime error';
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown) {
    // Keep stack in browser console for debugging.
    console.error('App runtime error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
          <Paper sx={{ p: 3, maxWidth: 720 }}>
            <Typography variant="h6" color="error" gutterBottom>
              Frontend runtime error
            </Typography>
            <Typography variant="body2">{this.state.message}</Typography>
          </Paper>
        </Box>
      );
    }
    return this.props.children;
  }
}

export default AppErrorBoundary;

