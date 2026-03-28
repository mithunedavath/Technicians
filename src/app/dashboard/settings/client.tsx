"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Papa from "papaparse";
import { Separator } from "@/components/ui/separator";
import { Loader2, Info, Save, Lock, FileArchive } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { doc, setDoc } from "firebase/firestore";
import { useFirestore, useDoc, useMemoFirebase, useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { generateMasterReport } from "../master-report-action";

export function SettingsClient() {
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const db = useFirestore();

    useEffect(() => {
        if (!isUserLoading && !user) {
            router.push('/login');
        }
    }, [user, isUserLoading, router]);

    // Use Firestore to fetch and persist global settings
    const configRef = useMemoFirebase(() => doc(db, "settings", "config"), [db]);
    const { data: config, isLoading: isConfigFetching } = useDoc(configRef);

    const [url, setUrl] = useState("");
    const [gid, setGid] = useState("0");
    const [headers, setHeaders] = useState<string[]>([]);
    const [isFetchingHeaders, setIsFetchingHeaders] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isGeneratingMaster, setIsGeneratingMaster] = useState(false);

    // Column Config State
    const [columns, setColumns] = useState<Record<string, string>>({});

    const columnFields = [
        { key: "stateColumn", label: "State" },
        { key: "technicianColumn", label: "Technician / Company Name" },
        { key: "vendorCodeColumn", label: "Vendor Code (for DB lookup)" },
        { key: "dateColumn", label: "Update Date" },
        { key: "timeColumn", label: "Time/Hours (TAT)" },
        { key: "statusColumn", label: "Status (Closed/Open)" },
        { key: "billingCycleColumn", label: "Billing Cycle" },
        { key: "locationColumn", label: "Location/Call Type (LC, UC, etc.)" },
        { key: "additionalKmColumn", label: "Additional KM" },
        { key: "coordinatorColumn", label: "Coordinator" },
        { key: "deductionsColumn", label: "Deductions" },
        { key: "vendorTypeColumn", label: "Vendor Type (ASP/Direct)" },
    ];

    useEffect(() => {
        if (config) {
            setUrl(config.googleSheetUrl || "");
            setGid(config.masterGid || "0");
            if (config.columnConfig) setColumns(config.columnConfig);
            if (config.googleSheetUrl) fetchHeaders(config.googleSheetUrl, config.masterGid || "0");
        }
    }, [config]);

    const fetchHeaders = (sheetUrl: string, sheetGid: string = "0") => {
        if (!sheetUrl) return;
        let csvUrl = sheetUrl;
        
        try {
            const urlObj = new URL(sheetUrl);
            const sheetId = urlObj.pathname.split('/d/')[1]?.split('/')[0];
            if (sheetId) {
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${sheetGid}`;
            }
        } catch (e) { 
            console.error("URL Parsing Error", e);
        }

        setIsFetchingHeaders(true);
        Papa.parse(csvUrl, {
            download: true,
            header: true,
            skipEmptyLines: true,
            preview: 1,
            complete: (results) => {
                if (results.meta.fields && results.meta.fields.length > 0) {
                    setHeaders(results.meta.fields);
                    toast({ title: "Headers Loaded", description: `Found ${results.meta.fields.length} columns.` });
                } else {
                    toast({ variant: "destructive", title: "No Columns Found", description: "Ensure the sheet is 'Published to the web' and the GID is correct." });
                }
                setIsFetchingHeaders(false);
            },
            error: (err) => {
                toast({ variant: "destructive", title: "Fetch Failed", description: "Sheet must be 'Published to the web' (File > Share > Publish to web)." });
                setIsFetchingHeaders(false);
            }
        });
    }

    const handleSave = async () => {
        setIsSaving(true);
        try {
            if (url) {
                try { new URL(url); } catch { throw new Error("Invalid URL format."); }
            }
            
            // Save to Firestore for global persistence
            await setDoc(configRef, {
                googleSheetUrl: url,
                masterGid: gid,
                columnConfig: columns,
                updatedAt: new Date().toISOString()
            });

            toast({ title: "Settings Saved", description: "Master configuration is now active for all users." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Save Error", description: error.message || "Failed to save settings." });
        } finally {
            setIsSaving(false);
        }
    };

    const handleMasterReport = async () => {
        if (!config || !config.googleSheetUrl) {
            toast({ variant: "destructive", title: "Config Missing", description: "Please save the Master Sheet URL first." });
            return;
        }

        setIsGeneratingMaster(true);
        try {
            const urlObj = new URL(config.googleSheetUrl);
            const sheetId = urlObj.pathname.split('/d/')[1]?.split('/')[0];
            if (!sheetId) throw new Error("Invalid Google Sheet URL format.");

            const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${config.masterGid || '0'}&t=${new Date().getTime()}`;

            Papa.parse(csvUrl, {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    const data = results.data as any[];
                    if (data.length === 0) {
                        toast({ variant: "destructive", title: "Error", description: "No data found in sheet." });
                        setIsGeneratingMaster(false);
                        return;
                    }

                    try {
                        const result = await generateMasterReport({ allReports: data, columnConfig: config.columnConfig });
                        if (result.data) {
                            const link = document.createElement("a");
                            link.href = URL.createObjectURL(new Blob([new Uint8Array(atob(result.data).split("").map(c => c.charCodeAt(0)))], {type: 'application/vnd.officedocument.spreadsheetml.sheet'}));
                            link.download = "master_payout_report.xlsx";
                            link.click();
                            toast({ title: "Success", description: "Master XLSX report generated." });
                        }
                    } catch (e: any) {
                        toast({ variant: "destructive", title: "Error", description: e.message });
                    } finally {
                        setIsGeneratingMaster(false);
                    }
                },
                error: (err) => {
                    toast({ variant: "destructive", title: "Fetch Error", description: "Could not fetch sheet data." });
                    setIsGeneratingMaster(false);
                }
            });
        } catch (e: any) {
            toast({ variant: "destructive", title: "Error", description: e.message });
            setIsGeneratingMaster(false);
        }
    };

    const updateColumn = (key: string, value: string) => {
        setColumns(prev => ({ ...prev, [key]: value }));
    };

    if (isUserLoading || !user) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }

    if (isConfigFetching) return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <div className="space-y-6">
            <Alert className="bg-primary/5 border-primary/20">
                <Lock className="h-4 w-4 text-primary" />
                <AlertTitle className="text-primary font-bold">Admin Settings Panel</AlertTitle>
                <AlertDescription className="text-muted-foreground">
                    Only authenticated admin users can modify these global configuration settings.
                </AlertDescription>
            </Alert>

            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle>Master Configuration</CardTitle>
                    <CardDescription>Link your master Google Sheet and map its columns to report fields.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-4 items-end">
                            <div className="md:col-span-3 space-y-2">
                                <Label htmlFor="gs-url">Google Sheet URL</Label>
                                <Input
                                    id="gs-url"
                                    value={url}
                                    onChange={(e) => setUrl(e.target.value)}
                                    placeholder="https://docs.google.com/spreadsheets/d/..."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gs-gid">Sheet GID</Label>
                                <div className="flex gap-2">
                                    <Input id="gs-gid" value={gid} onChange={(e) => setGid(e.target.value)} placeholder="0" />
                                    <Button onClick={() => fetchHeaders(url, gid)} disabled={isFetchingHeaders} variant="outline" size="icon" title="Fetch Headers">
                                        {isFetchingHeaders ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <h3 className="text-lg font-semibold">Column Mapping</h3>
                            {headers.length === 0 && <span className="text-xs text-destructive flex items-center gap-1"><Info className="h-3 w-3" /> Fetch headers first</span>}
                        </div>
                        
                        {headers.length > 0 || Object.keys(columns).length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                                {columnFields.map((field) => (
                                    <div key={field.key} className="space-y-1.5">
                                        <Label className="text-xs font-bold uppercase text-muted-foreground">{field.label}</Label>
                                        <Select value={columns[field.key] || undefined} onValueChange={(val) => updateColumn(field.key, val)}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Select column" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {headers.length > 0 ? headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>) : 
                                                (columns[field.key] && columns[field.key] !== "" ? <SelectItem value={columns[field.key]}>{columns[field.key]}</SelectItem> : null)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center p-12 border border-dashed rounded-lg bg-muted/20">
                                <Info className="h-8 w-8 text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground">Link your sheet URL and click fetch to map columns.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
                <CardFooter className="bg-muted/30 pt-6">
                    <Button onClick={handleSave} disabled={isSaving} className="w-full md:w-auto">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Apply & Save Global Settings
                    </Button>
                </CardFooter>
            </Card>

            <Card className="shadow-md">
                <CardHeader>
                    <CardTitle>Bulk Actions</CardTitle>
                    <CardDescription>Export and generate master reports for administrative overview.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-4">
                        <p className="text-sm text-muted-foreground">
                            Generate a comprehensive XLSX file containing payout calculations for all technicians across all coordinators.
                        </p>
                        <Button variant="outline" className="w-full md:w-auto" disabled={isGeneratingMaster} onClick={handleMasterReport}>
                            {isGeneratingMaster ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileArchive className="mr-2 h-4 w-4" />}
                            Export Master XLSX Report
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
