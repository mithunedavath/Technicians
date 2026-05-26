
"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { collection, query, orderBy, serverTimestamp, getDocs, where } from "firebase/firestore";
import { useFirestore, useCollection, useMemoFirebase, useUser } from "@/firebase";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Plus, Search, Loader2, Upload, Download, CheckCircle2, AlertTriangle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";

// Exhaustive mapping for all vendor fields as per the required template
const VENDOR_FIELDS_MAP: Record<string, string> = {
  "Company Name": "companyName",
  "Vendor Type": "vendorType",
  "Joining Date": "joiningDate",
  "Status": "status",
  "Associated Brands": "associatedBrands",
  "Available Technicians": "availableTechnicians",
  "Available Coordinators": "availableCoordinators",
  "Owner Name": "ownerName",
  "Owners Father Name": "ownersFatherName",
  "Contact Number": "contactNumber",
  "Email": "email",
  "State": "state",
  "City": "city",
  "GST Number": "gstNumber",
  "PAN Number": "panNumber",
  "Aadhar Number": "aadharNumber",
  "Establishment Address": "establishmentAddress",
  "Owner Personal Address": "ownerPersonalAddress",
  "Bank Account Number": "bankAccountNumber",
  "Bank Name": "bankName",
  "Branch Name": "branchName",
  "IFSC Code": "ifscCode",
  "Bank Address": "bankAddress",
  "Rate LC": "rateLC",
  "Incentive MSL": "incentiveMSL",
  "TAT Penalty": "tatPenalty",
  "Customer Code": "customerCode",
  "Vendor Code": "vendorCode",
  "Document Link": "documentLink",
  "Agreement Link": "agreementLink",
  "Bill To Address": "billingAddress",
  "Bill To GSTIN": "billingGstin",
  "GST Type": "billingGstType",
  "Districts Covered": "districtsCovered",
  "District Covered": "districtsCovered"
};

export default function VendorsPage() {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const db = useFirestore();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [vendorNameSearch, setVendorNameSearch] = useState("");
  const [selectedStateFilter, setSelectedStateFilter] = useState("ALL STATES");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.push('/login');
    }
  }, [user, isUserLoading, router]);

  const vendorsRef = useMemoFirebase(() => query(collection(db, "vendors"), orderBy("companyName")), [db]);
  const { data: vendors, isLoading } = useCollection(vendorsRef);

  // Dynamically extract unique states from all registered vendors
  const uniqueStates = useMemo(() => {
    if (!vendors) return [];
    const states = vendors
      .map(v => v.state?.trim())
      .filter(Boolean);
    
    // Capitalize correctly (Title Case)
    const formatted = states.map(s => {
      return s.split(" ")
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    });

    return [...new Set(formatted)].sort();
  }, [vendors]);

  // Combined search, name search, and state filtering
  const filteredVendors = useMemo(() => {
    if (!vendors) return [];
    return vendors.filter(v => {
      // 1. State Filter
      const stateMatch = selectedStateFilter === "ALL STATES" || 
        v.state?.trim().toUpperCase() === selectedStateFilter.toUpperCase();

      // 2. Dedicated Vendor Name Filter
      const nameMatch = !vendorNameSearch ||
        v.companyName?.toLowerCase().includes(vendorNameSearch.toLowerCase());

      // 3. General Codes/Details Search
      const searchMatch = !searchTerm ||
        v.vendorCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.panNumber?.toLowerCase().includes(searchTerm.toLowerCase());

      return stateMatch && nameMatch && searchMatch;
    });
  }, [vendors, selectedStateFilter, vendorNameSearch, searchTerm]);

  // Count active centers based on selected state and name search
  const stateVendorCount = useMemo(() => {
    if (!vendors) return 0;
    
    let list = vendors;
    
    if (selectedStateFilter !== "ALL STATES") {
      list = list.filter(v => v.state?.trim().toUpperCase() === selectedStateFilter.toUpperCase());
    }
    
    if (vendorNameSearch) {
      list = list.filter(v => v.companyName?.toLowerCase().includes(vendorNameSearch.toLowerCase()));
    }
    
    return list.length;
  }, [vendors, selectedStateFilter, vendorNameSearch]);

  const handleDownloadTemplate = () => {
    const headers = Object.keys(VENDOR_FIELDS_MAP);
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendors Template");
    XLSX.writeFile(wb, "vendor_upload_template.xlsx");
    toast({ title: "Template Downloaded", description: "Use this file for bulk uploads." });
  };

  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

        if (jsonData.length === 0) throw new Error("File is empty.");

        let successCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;

        // Optimized check for existing records
        const existingVendorCodes = new Set(vendors?.map(v => v.vendorCode?.toLowerCase()).filter(Boolean));
        const existingPans = new Set(vendors?.map(v => v.panNumber?.toLowerCase()).filter(Boolean));

        for (const row of jsonData) {
          const vendorData: any = {};
          const normalizedRow: any = {};
          Object.keys(row).forEach(k => normalizedRow[k.trim()] = row[k]);

          Object.entries(VENDOR_FIELDS_MAP).forEach(([header, field]) => {
            vendorData[field] = normalizedRow[header] !== undefined ? String(normalizedRow[header]).trim() : "";
          });

          if (!vendorData.companyName || !vendorData.vendorCode) {
            errorCount++;
            continue;
          }

          const vCode = vendorData.vendorCode.toLowerCase();
          const pan = vendorData.panNumber?.toLowerCase();

          if (existingVendorCodes.has(vCode) || (pan && existingPans.has(pan))) {
            duplicateCount++;
            continue;
          }

          addDocumentNonBlocking(collection(db, "vendors"), {
            ...vendorData,
            status: vendorData.status || "Active",
            createdAt: serverTimestamp()
          });
          
          // Optimistically add to local sets to handle duplicates within the same file
          existingVendorCodes.add(vCode);
          if (pan) existingPans.add(pan);
          
          successCount++;
        }

        toast({ 
          title: "Import Complete", 
          description: `Added: ${successCount}, Duplicates: ${duplicateCount}, Skipped (Missing Data): ${errorCount}` 
        });
      } catch (error: any) {
        toast({ variant: "destructive", title: "Upload Failed", description: error.message });
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (isUserLoading || !user) return null;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Vendors & Service Centers</h1>
          <p className="text-muted-foreground">Manage your registration database for technician payouts.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls, .csv" onChange={handleBulkUpload} />
          <Button variant="outline" onClick={handleDownloadTemplate} disabled={isUploading}>
            <Download className="mr-2 h-4 w-4" /> Template
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
            {isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Bulk Upload
          </Button>
          <Button asChild className="bg-primary hover:bg-primary/90">
            <Link href="/dashboard/vendors/new"><Plus className="mr-2 h-4 w-4" /> Add New</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/10">
          <CardContent className="pt-6">
            <p className="text-xs font-bold text-primary uppercase mb-1">
              {selectedStateFilter === "ALL STATES" ? "Total Centers (National)" : `Centers in ${selectedStateFilter}`}
            </p>
            <h3 className="text-3xl font-black text-primary">{stateVendorCount}</h3>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg border-primary/5 overflow-hidden">
        <CardHeader className="bg-muted/30 border-b pb-6">
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2"><Building2 className="h-4 w-4" /> Directory</CardTitle>
            <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
              {/* State Filter Dropdown */}
              <Select value={selectedStateFilter} onValueChange={setSelectedStateFilter}>
                <SelectTrigger className="w-[150px] bg-white border-primary/20">
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent className="bg-white">
                  <SelectItem value="ALL STATES">🌐 All States</SelectItem>
                  {uniqueStates.map(state => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
 
              {/* Dedicated Vendor Name Search */}
              <div className="relative w-56">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Filter by vendor name..." 
                    value={vendorNameSearch} 
                    onChange={(e) => setVendorNameSearch(e.target.value)} 
                    className="pl-9 bg-white" 
                  />
              </div>
 
              {/* General Codes/Details Search */}
              <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search by code, city, PAN..." 
                    value={searchTerm} 
                    onChange={(e) => setSearchTerm(e.target.value)} 
                    className="pl-9 bg-white" 
                  />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-24 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : filteredVendors && filteredVendors.length > 0 ? (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="font-bold">Company / Center Name</TableHead>
                  <TableHead className="font-bold">Vendor Code</TableHead>
                  <TableHead className="font-bold">Owner</TableHead>
                  <TableHead className="font-bold">City</TableHead>
                  <TableHead className="font-bold">Status</TableHead>
                  <TableHead className="text-right font-bold pr-8">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVendors.map((v) => (
                  <TableRow key={v.id} className="hover:bg-primary/5">
                    <TableCell className="font-semibold">{v.companyName}</TableCell>
                    <TableCell className="font-mono text-xs text-primary font-bold">{v.vendorCode}</TableCell>
                    <TableCell className="text-xs">{v.ownerName}</TableCell>
                    <TableCell className="text-xs">{v.city}</TableCell>
                    <TableCell>
                      <Badge variant={v.status === "Active" ? "default" : "secondary"}>{v.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <Button variant="ghost" size="sm" asChild><Link href={`/dashboard/vendors/${v.id}`}>View Details</Link></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-24 text-center text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <p>No vendor records found matching your search.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
