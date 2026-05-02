import { Component, type ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    if (this.props.fallback) return this.props.fallback

    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <AlertTriangle size={24} className="text-red-400" />
        </div>
        <h3 className="text-white font-medium mb-1">เกิดข้อผิดพลาด</h3>
        <p className="text-slate-400 text-sm mb-4 max-w-xs">{this.state.message}</p>
        <button
          onClick={this.handleReset}
          className="text-sm bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          ลองใหม่
        </button>
      </div>
    )
  }
}
