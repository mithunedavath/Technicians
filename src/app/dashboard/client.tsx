"use client";

import { useState, useEffect } from "react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sheet, Map, AlertTriangle, FileText, Settings, Filter, BarChart3 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Report } from "./components/report";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { doc, collection, query, where } from "firebase/firestore";
import { useFirestore, useDoc, useMemoFirebase, useCollection } from "@/firebase";

type CsvRow = { [key: string]: string };

export function DashboardClient() {
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const db = useFirestore();

  // Load global configuration from Firestore
  const configRef = useMemoFirebase(() => doc(db, "settings", "config"), [db]);
  const { data: config, isLoading: isConfigLoading } = useDoc(configRef);
  
  const [allReports, setAllReports] = useState<CsvRow[]>([]);
  const [filteredReports, setFilteredReports] = useState<CsvRow[]>([]);
  
  const [coordinators, setCoordinators] = useState<string[]>([]);
  const [vendorTypes, setVendorTypes] = useState<string[]>([]);
  const [technicians, setTechnicians] = useState<string[]>([]);
  const [billingCycles, setBillingCycles] = useState<string[]>([]);
  
  const [selectedCoordinator, setSelectedCoordinator] = useState<string>("");
  const [selectedVendorType, setSelectedVendorType] = useState<string>("");
  const [selectedTechnician, setSelectedTechnician] = useState<string>("");
  const [selectedBillingCycle, setSelectedBillingCycle] = useState<string>("");

  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [isPayoutDialogOpen, setIsPayoutDialogOpen] = useState(false);
  const [selectedPayoutType, setSelectedPayoutType] = useState<string>("");
  const [fixedSalary, setFixedSalary] = useState<string>("");
  const [payoutAddress, setPayoutAddress] = useState<string>("");
  const [payoutPan, setPayoutPan] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  
  // Initialize to empty to avoid hydration mismatch with local time
  const [invoiceDate, setInvoiceDate] = useState<string>("");
  
  // Handle client-side initialization to avoid hydration errors
  useEffect(() => {
    setInvoiceDate(new Date().toISOString().split('T')[0]);
  }, []);

  // Use the mapped Vendor Code column to find the code for the selected technician
  const getSelectedVendorCode = () => {
    if (!selectedTechnician || !config?.columnConfig?.vendorCodeColumn) return null;
    const techRow = filteredReports.find(row => row[config.columnConfig.technicianColumn] === selectedTechnician);
    return techRow ? techRow[config.columnConfig.vendorCodeColumn] : null;
  };

  const selectedVendorCode = getSelectedVendorCode();
  const technicianNameForQuery = selectedTechnician ? selectedTechnician.trim() : "";

  // Update query to prioritize Vendor Code if available, otherwise fallback to Name
  const vendorQuery = useMemoFirebase(() => {
    if (!db) return null;
    if (selectedVendorCode) {
        return query(collection(db, "vendors"), where("vendorCode", "==", selectedVendorCode));
    }
    if (technicianNameForQuery) {
        return query(collection(db, "vendors"), where("companyName", "==", technicianNameForQuery));
    }
    return null;
  }, [db, selectedVendorCode, technicianNameForQuery]);
  
  const { data: matchedVendors, isLoading: isVendorFetching } = useCollection(vendorQuery);
  const matchedVendor = matchedVendors?.[0];

  useEffect(() => {
    if (!selectedTechnician) {
        setPayoutAddress("");
        setPayoutPan("");
        return;
    }

    if (matchedVendor) {
        setPayoutAddress(matchedVendor.establishmentAddress || "");
        setPayoutPan(matchedVendor.panNumber || "");
    } else if (!isVendorFetching) {
        // Clear if we have a technician but no matching vendor found in DB
        setPayoutAddress("");
        setPayoutPan("");
    }
  }, [matchedVendor, selectedTechnician, isVendorFetching]);

  useEffect(() => {
    const fetchAllData = async () => {
        if (!config || !config.googleSheetUrl || !config.columnConfig) {
            if (!isConfigLoading) setIsLoading(false);
            return;
        }

        const columnConfig = config.columnConfig;
        const { coordinatorColumn, vendorTypeColumn, billingCycleColumn } = columnConfig;

        setIsLoading(true);

        try {
            const urlObj = new URL(config.googleSheetUrl);
            const sheetId = urlObj.pathname.split('/d/')[1]?.split('/')[0];
            if (!sheetId) throw new Error("Invalid Google Sheet URL format.");

            // Add timestamp to CSV URL to force fresh fetch and avoid caching
            const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${config.masterGid || '0'}&t=${new Date().getTime()}`;
            
            Papa.parse(csvUrl, {
                download: true,
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const data = results.data as CsvRow[];
                    setAllReports(data);

                    if (data.length === 0) {
                        toast({ variant: "destructive", title: "No Data Found", description: "Verify sheet permissions (Publish to web) and GID." });
                    } else {
                        if (coordinatorColumn) {
                            const uniqueCoordinators = [...new Set(data.map(row => row[coordinatorColumn]).filter(Boolean))].sort();
                            setCoordinators(uniqueCoordinators);
                        }
                        if (vendorTypeColumn) {
                            const uniqueVT = [...new Set(data.map(row => row[vendorTypeColumn]).filter(Boolean))].sort();
                            setVendorTypes(uniqueVT);
                        }
                        if (billingCycleColumn) {
                            const uniqueBC = [...new Set(data.map(row => row[billingCycleColumn]).filter(Boolean))].sort();
                            setBillingCycles(uniqueBC);
                        }
                    }
                    setIsLoading(false);
                },
                error: (err) => {
                    toast({ variant: "destructive", title: "Fetch Error", description: "Is the sheet 'Published to the web'?" });
                    setIsLoading(false);
                }
            });

        } catch (error: any) {
            toast({ variant: "destructive", title: "URL Error", description: error.message });
            setIsLoading(false);
        }
    };

    if (!isConfigLoading) fetchAllData();
  }, [toast, config, isConfigLoading]);
  
  useEffect(() => {
        if (!config || !config.columnConfig) return;
        const { technicianColumn, coordinatorColumn, vendorTypeColumn } = config.columnConfig;

        if (allReports.length > 0 && technicianColumn) {
            let filtered = allReports;
            if (selectedCoordinator) filtered = filtered.filter(row => row[coordinatorColumn] === selectedCoordinator);
            if (selectedVendorType) filtered = filtered.filter(row => row[vendorTypeColumn] === selectedVendorType);
            const techniciansToShow = [...new Set(filtered.map(row => row[technicianColumn]).filter(Boolean))].sort();
            setTechnicians(techniciansToShow);
        } else {
            setTechnicians([]);
        }
        if (selectedCoordinator || selectedVendorType) setSelectedTechnician("");
  }, [selectedCoordinator, selectedVendorType, allReports, config]);

  const applyFilters = () => {
    if (!selectedCoordinator || !selectedVendorType) {
        toast({ variant: 'destructive', title: 'Selection Required', description: 'Please select coordinator and vendor type.' });
        return;
    }

    if (!config || !config.columnConfig) return;
    const { coordinatorColumn, technicianColumn, billingCycleColumn, vendorTypeColumn } = config.columnConfig;

    const filtered = allReports.filter(row => {
        const rowCoordinator = row[coordinatorColumn] === selectedCoordinator;
        const rowVendorType = row[vendorTypeColumn] === selectedVendorType;
        const rowTechnician = !selectedTechnician || row[technicianColumn] === selectedTechnician;
        const rowBillingCycle = !selectedBillingCycle || (billingCycleColumn && row[billingCycleColumn] === selectedBillingCycle);
        return rowCoordinator && rowVendorType && rowTechnician && rowBillingCycle;
    });
    setFilteredReports(filtered);
    toast({ title: "Filters Applied", description: `${filtered.length} records found.` });
  };
  
  const handleGenerateReportClick = () => {
      if(!invoiceNumber) {
          const prefix = "INV";
          const random = Math.floor(1000 + Math.random() * 9000);
          setInvoiceNumber(`${prefix}-${random}`);
      }
      setIsPayoutDialogOpen(true);
  };

  const handlePayoutSelect = () => {
      if (!selectedPayoutType) {
          toast({ variant: "destructive", title: "Required", description: "Select a payout structure." });
          return;
      }
      if (selectedPayoutType === 'OFF_ROLL' && !fixedSalary) {
          toast({ variant: "destructive", title: "Required", description: "Enter fixed salary for Off Roll." });
          return;
      }
      if (!payoutAddress || !payoutPan) {
          toast({ variant: "destructive", title: "Required", description: "Address and PAN are mandatory for invoices." });
          return;
      }
      if (!invoiceNumber || !invoiceDate) {
          toast({ variant: "destructive", title: "Required", description: "Invoice Number and Date are mandatory." });
          return;
      }
      setIsPayoutDialogOpen(false);
      setIsReportDialogOpen(true);
  }

  if (isConfigLoading || isLoading) return <div className="flex flex-col items-center justify-center h-full gap-4">
    <Loader2 className="h-10 w-10 animate-spin text-primary" />
    <p className="text-sm text-muted-foreground animate-pulse">Synchronizing with Master Sheet...</p>
  </div>;

  if (!config || !config.googleSheetUrl) {
    return (
        <Card className="max-w-2xl mx-auto mt-12 border-destructive/20 shadow-2xl bg-white/50 backdrop-blur-sm">
            <CardHeader><CardTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-6 w-6" />Setup Required</CardTitle></CardHeader>
            <CardContent>
                <p className="text-muted-foreground mb-6">Database configuration is missing. A master Google Sheet URL and column mapping must be set in the settings panel to continue.</p>
                <Button asChild className="w-full bg-primary hover:bg-primary/90"><Link href="/dashboard/settings"><Settings className="mr-2 h-4 w-4" />Go to Settings</Link></Button>
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-4 animate-in fade-in duration-500">
        <div className="lg:col-span-1 flex flex-col gap-6">
            <Card className="shadow-lg border-primary/10 overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                    <CardTitle className="text-lg flex items-center gap-2 text-primary">
                        <Filter className="h-4 w-4" /> Data Selection
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase">Coordinator</Label>
                        <Select value={selectedCoordinator} onValueChange={setSelectedCoordinator}>
                            <SelectTrigger className="hover:border-primary/50 transition-colors">
                                <SelectValue placeholder="Select coordinator" />
                            </SelectTrigger>
                            <SelectContent>{coordinators.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase">Vendor Type</Label>
                        <Select value={selectedVendorType} onValueChange={setSelectedVendorType}>
                            <SelectTrigger className="hover:border-primary/50 transition-colors">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>{vendorTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase">Technician / Company</Label>
                        <Select value={selectedTechnician} onValueChange={setSelectedTechnician} disabled={!selectedCoordinator}>
                            <SelectTrigger className="hover:border-primary/50 transition-colors">
                                <SelectValue placeholder="All Technicians" />
                            </SelectTrigger>
                            <SelectContent>{technicians.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground uppercase">Billing Cycle</Label>
                        <Select value={selectedBillingCycle} onValueChange={setSelectedBillingCycle}>
                            <SelectTrigger className="hover:border-primary/50 transition-colors">
                                <SelectValue placeholder="All Cycles" />
                            </SelectTrigger>
                            <SelectContent>{billingCycles.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <Button onClick={applyFilters} disabled={!selectedCoordinator} className="w-full mt-4 bg-primary shadow-md hover:shadow-lg transition-all">
                        <Map className="mr-2 h-4 w-4" /> Fetch Records
                    </Button>
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-3">
            <Card className="min-h-[70vh] shadow-lg border-primary/10 overflow-hidden bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b bg-muted/30">
                <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-primary" /> Records Overview
                    </CardTitle>
                    {filteredReports.length > 0 && (
                        <Button onClick={handleGenerateReportClick} className="bg-accent hover:bg-accent/90 text-accent-foreground shadow-md transition-all">
                            <FileText className="mr-2 h-4 w-4" /> Generate Payout Invoice
                        </Button>
                    )}
                </div>
            </CardHeader>
            <CardContent className="pt-6">
                {filteredReports.length > 0 ? (
                <div className="space-y-6">
                    <div className="text-sm text-muted-foreground font-medium bg-primary/5 py-2 px-4 rounded-full inline-block border border-primary/10">
                        Found {filteredReports.length} records matching your current filters
                    </div>
                    
                    <Dialog open={isPayoutDialogOpen} onOpenChange={setIsPayoutDialogOpen}>
                        <DialogContent className="max-w-md border-primary/20 shadow-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-primary flex items-center gap-2">
                                    <FileText className="h-5 w-5" /> Invoice Configuration
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-2">
                                {matchedVendor && (
                                    <div className="bg-green-50 p-4 rounded-xl text-xs border border-green-200 mb-2 flex items-start gap-3">
                                        <BarChart3 className="h-4 w-4 text-green-600 mt-0.5" />
                                        <div>
                                            <p className="font-bold text-green-800">Verified Service Center!</p>
                                            <p className="text-green-700">Company details, address, and PAN pre-filled from your Vendor database {selectedVendorCode ? `(matched by Code: ${selectedVendorCode})` : '(matched by Name)'}.</p>
                                        </div>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label className="text-xs uppercase font-bold text-muted-foreground">Invoice No.</Label><Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className="focus:border-primary" /></div>
                                    <div className="space-y-2"><Label className="text-xs uppercase font-bold text-muted-foreground">Invoice Date</Label><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="focus:border-primary" /></div>
                                </div>
                                <div className="space-y-2"><Label className="text-xs uppercase font-bold text-muted-foreground">Vendor Address</Label><Textarea value={payoutAddress} onChange={(e) => setPayoutAddress(e.target.value)} placeholder="Full business address..." className="min-h-[100px] focus:border-primary" /></div>
                                <div className="space-y-2"><Label className="text-xs uppercase font-bold text-muted-foreground">Vendor PAN</Label><Input value={payoutPan} onChange={(e) => setPayoutPan(e.target.value.toUpperCase())} placeholder="ABCDE1234F" className="focus:border-primary" /></div>
                                <Separator className="my-6" />
                                <div className="space-y-2">
                                    <Label className="text-xs uppercase font-bold text-muted-foreground">Payout Structure</Label>
                                    <Select value={selectedPayoutType} onValueChange={setSelectedPayoutType}>
                                        <SelectTrigger className="focus:ring-primary">
                                            <SelectValue placeholder="Select structure" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="DELHI/NCR">Delhi / NCR Region</SelectItem>
                                            <SelectItem value="REST_OF_INDIA">Rest of India</SelectItem>
                                            <SelectItem value="OFF_ROLL">Off Roll (Fixed Salary)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {selectedPayoutType === 'OFF_ROLL' && <div className="space-y-2 animate-in slide-in-from-top-2 duration-300"><Label className="text-xs uppercase font-bold text-muted-foreground">Fixed Monthly Salary (INR)</Label><Input type="number" value={fixedSalary} onChange={(e) => setFixedSalary(e.target.value)} className="focus:border-primary" /></div>}
                            </div>
                            <DialogFooter><Button onClick={handlePayoutSelect} className="w-full bg-primary text-white hover:bg-primary/90 py-6 text-lg shadow-lg">Preview & Download</Button></DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
                        <DialogContent className="max-w-6xl max-h-[95vh] overflow-y-auto border-primary/20">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-black text-primary border-b pb-4">Payout Analysis & Professional Invoice</DialogTitle>
                            </DialogHeader>
                            <Report 
                                filteredReports={filteredReports}
                                payoutType={selectedPayoutType}
                                fixedSalary={selectedPayoutType === 'OFF_ROLL' ? parseFloat(fixedSalary) : undefined}
                                address={payoutAddress}
                                pan={payoutPan}
                                invoiceNumber={invoiceNumber}
                                invoiceDate={invoiceDate}
                                filters={{ state: selectedCoordinator, month: '', technician: selectedTechnician, billingCycle: selectedBillingCycle }}
                                columnConfig={config.columnConfig}
                            />
                        </DialogContent>
                    </Dialog>
                    
                    <div className="max-h-[500px] overflow-auto rounded-xl border-2 border-primary/5 text-xs bg-white/50 shadow-inner">
                        <Table>
                            <TableHeader className="bg-primary/5 sticky top-0 z-10">
                                <TableRow>{filteredReports[0] && Object.keys(filteredReports[0]).map(k => <TableHead key={k} className="whitespace-nowrap font-bold text-primary px-6">{k}</TableHead>)}</TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredReports.map((r, i) => (
                                    <TableRow key={i} className="hover:bg-primary/5 transition-colors group">
                                        {Object.values(r).map((v, j) => <TableCell key={j} className="whitespace-nowrap px-6 py-3 border-b border-primary/5">{v}</TableCell>)}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
                ) : (
                    <div className="flex flex-col items-center justify-center p-24 border-2 border-dashed rounded-3xl bg-primary/5 border-primary/20 animate-pulse">
                        <div className="bg-white p-6 rounded-full shadow-lg mb-6">
                            <Sheet className="h-12 w-12 text-primary/40" />
                        </div>
                        <p className="mt-2 text-xl font-bold text-primary/60">Ready to Analyze</p>
                        <p className="text-sm text-muted-foreground max-w-xs text-center">Use the selection panel on the left to pull real-time data from the master worksheet.</p>
                    </div>
                )}
            </CardContent>
            </Card>
        </div>
    </div>
  );
}
