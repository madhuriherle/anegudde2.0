import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';










class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    const message = error instanceof Error ? error.message : 'Unknown runtime error';
    return { hasError: true, message };
  }

  componentDidCatch(error) {
    console.error('App runtime error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <Card className="max-w-xl w-full border-red-100 bg-red-50/30">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <CardTitle className="text-xl font-bold text-red-700">Frontend Runtime Error</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-white rounded-lg border border-red-100 font-mono text-sm text-red-600 overflow-auto max-h-[400px]">
                {this.state.message}
              </div>
              <p className="mt-4 text-sm text-gray-500">
                A critical error occurred. Please try refreshing the page or contact the administrator if the issue persists.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-6 w-full py-2 bg-red-600 text-white rounded-md font-bold hover:bg-red-700 transition-colors">
                
                Refresh Application
              </button>
            </CardContent>
          </Card>
        </div>);

    }
    return this.props.children;
  }
}

export default AppErrorBoundary;