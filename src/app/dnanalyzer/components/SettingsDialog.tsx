import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Settings, Eye, EyeOff } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"

interface MySQLConfig {
    host: string
    user: string
    password: string
    database: string
    port: number
}

interface SettingsDialogProps {
    isOpen: boolean
    onOpenChange: (open: boolean) => void
    mysqlConfig: MySQLConfig
    setMysqlConfig: (config: MySQLConfig) => void
    googleApiKey: string
    setGoogleApiKey: (key: string) => void
    showMySQLPassword: boolean
    setShowMySQLPassword: (show: boolean) => void
    showApiKey: boolean
    setShowApiKey: (show: boolean) => void
    savingConfig: boolean
    onSaveConfig: () => void
}

export default function SettingsDialog({
    isOpen,
    onOpenChange,
    mysqlConfig,
    setMysqlConfig,
    googleApiKey,
    setGoogleApiKey,
    showMySQLPassword,
    setShowMySQLPassword,
    showApiKey,
    setShowApiKey,
    savingConfig,
    onSaveConfig,
}: SettingsDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button
                    variant="secondary"
                    className="ml-auto flex h-9 items-center gap-0 rounded-xl border border-transparent bg-transparent px-3 text-black/55 shadow-none hover:bg-black/[0.055] hover:text-black dark:text-white/55 dark:hover:bg-white/[0.07] dark:hover:text-white sm:gap-2"
                >
                    <Settings className="w-4 h-4" />
                    <span className="hidden sm:inline">Settings</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="rounded-2xl border-black/[0.08] bg-[#fafaf8] shadow-2xl dark:border-white/[0.09] dark:bg-[#1a1a18] sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings className="w-5 h-5" />
                        Configuration Settings
                    </DialogTitle>
                    <DialogDescription>
                        Configure MySQL and Google Generative AI API key.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    {/* MySQL Configuration */}
                    <div className="space-y-4 rounded-xl border border-black/[0.07] bg-black/[0.02] p-4 dark:border-white/[0.08] dark:bg-white/[0.025]">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="host">Host</Label>
                                <Input
                                    id="host"
                                    placeholder="localhost"
                                    value={mysqlConfig.host}
                                    onChange={(e) => setMysqlConfig({ ...mysqlConfig, host: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="port">Port</Label>
                                <Input
                                    id="port"
                                    type="number"
                                    placeholder="3306"
                                    value={mysqlConfig.port}
                                    onChange={(e) => setMysqlConfig({ ...mysqlConfig, port: parseInt(e.target.value) || 3306 })}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="database">Database Name</Label>
                            <Input
                                id="database"
                                placeholder="dnanalyzer"
                                value={mysqlConfig.database}
                                onChange={(e) => setMysqlConfig({ ...mysqlConfig, database: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="user">Username</Label>
                                <Input
                                    id="user"
                                    placeholder="root"
                                    value={mysqlConfig.user}
                                    onChange={(e) => setMysqlConfig({ ...mysqlConfig, user: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showMySQLPassword ? "text" : "password"}
                                        placeholder="Enter password"
                                        value={mysqlConfig.password}
                                        onChange={(e) => setMysqlConfig({ ...mysqlConfig, password: e.target.value })}
                                        className="pr-10"
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                        onClick={() => setShowMySQLPassword(!showMySQLPassword)}
                                    >
                                        {showMySQLPassword ? (
                                            <EyeOff className="h-4 w-4 text-gray-400" />
                                        ) : (
                                            <Eye className="h-4 w-4 text-gray-400" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="space-y-1">
                            <p className="text-xs text-black/45 dark:text-white/45">
                                Use the same MySQL database as the one used in {' '}
                                <a
                                    href="https://dnanalyzer.org"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-black/65 underline decoration-black/20 underline-offset-2 hover:text-black dark:text-white/65 dark:decoration-white/20 dark:hover:text-white"
                                >
                                    DNAnalyzer
                                </a>
                            </p>
                            <p className="text-xs text-black/45 dark:text-white/45">
                                You can get a free MySQL database from{' '}
                                <a
                                    href="https://www.freesqldatabase.com/register/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-black/65 underline decoration-black/20 underline-offset-2 hover:text-black dark:text-white/65 dark:decoration-white/20 dark:hover:text-white"
                                >
                                    FreeSQLDatabase
                                </a>
                            </p>
                        </div>
                    </div>

                    {/* Google API Key */}
                    <div className="space-y-2">
                        <Label htmlFor="googleApiKey">Google Generative AI API Key</Label>
                        <div className="relative">
                            <Input
                                id="googleApiKey"
                                type={showApiKey ? "text" : "password"}
                                placeholder="Enter your Google API key"
                                value={googleApiKey}
                                onChange={(e) => setGoogleApiKey(e.target.value)}
                                className="pr-10"
                            />
                            <button
                                type="button"
                                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                onClick={() => setShowApiKey(!showApiKey)}
                            >
                                {showApiKey ? (
                                    <EyeOff className="h-4 w-4 text-gray-400" />
                                ) : (
                                    <Eye className="h-4 w-4 text-gray-400" />
                                )}
                            </button>
                        </div>
                        <p className="text-xs text-black/45 dark:text-white/45">
                            Get your free API key from{' '}
                            <a
                                href="https://aistudio.google.com/api-keys"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-black/65 underline decoration-black/20 underline-offset-2 hover:text-black dark:text-white/65 dark:decoration-white/20 dark:hover:text-white"
                            >
                                Google AI Studio
                            </a>
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            variant="secondary"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={onSaveConfig}
                            disabled={savingConfig}
                            className="flex items-center gap-2 rounded-xl bg-[#191918] text-white hover:bg-black dark:bg-[#f2f2ef] dark:text-[#191918] dark:hover:bg-white"
                        >
                            {savingConfig ? 'Saving...' : 'Save Configuration'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
