import { Component, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="rounded-lg border border-signal-red/20 bg-signal-red-light p-4 text-signal-red">
                    <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-5 w-5" />
                        <h4 className="font-semibold m-0 text-signal-red">Render Error</h4>
                    </div>
                    <p className="text-sm">
                        Failed to render the agent's output. The agent may have returned strangely formatted data.
                    </p>
                    {this.state.error && (
                        <pre className="mt-2 text-xs opacity-80 whitespace-pre-wrap">
                            {this.state.error.message}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
