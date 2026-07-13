import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  children: ReactNode;
  onGoHome?: () => void;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.log('App Error:', error);
    console.log('Error Info:', errorInfo);
  }

  private handleRecovery = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onGoHome?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong.</Text>
          {this.state.error?.message ? (
            <Text style={styles.message}>{this.state.error.message}</Text>
          ) : null}
          <Pressable onPress={this.handleRecovery} style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonText}>Back to Home</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#0B0F14',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F4F6F8',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B95A5',
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#FF7A59',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0B0F14',
  },
});

export default ErrorBoundary;
