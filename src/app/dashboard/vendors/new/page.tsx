
"use client";

import { useState, useEffect } from "react";
import { collection, serverTimestamp, query, where, getDocs } from "firebase/firestore";
import { useFirestore, useUser } from "@/firebase";
import { addDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { 
  Building2, 
  User, 
  MapPin, 
  CreditCard, 
  ShieldCheck,
  BadgeCent,
  Loader2,
  CheckCircle2,
  ChevronLeft,
  Link as LinkIcon
} from "lucide-react";

export default function NewVendorPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
  }, [user, isUserLoading, router]);

  const [formData, setFormData] = useState<any>({
    companyName: "",
    vendorType: "ASP",
    joiningDate: new Date().toISOString().split('T')[0],
    status: "Active",
    associatedBrands: "",
    availableTechnicians: "",
    availableCoordinators: "",
    ownerName: "",
    ownersFatherName: "",
    contactNumber: "",
    email: "",
    state: "",
    city: "",
    gstNumber: "",
    panNumber: "",
    aadharNumber: "",
    establishmentAddress: "",
    ownerPersonalAddress: "",
    bankAccountNumber: "",
    bankName: "",
    branchName: "",
    ifscCode: "",
    bankAddress: "",
    rateLC: "",
    incentiveMSL: "",
    tatPenalty: "",
    customerCode: "",
    vendorCode: "",
    documentLink: "",
    agreementLink: "",
    billingAddress: "",
    billingGstin: "",
    billingGstType: "NON GST",
    districtsCovered: ""
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.vendorCode) {
      toast({ variant: "destructive", title: "Missing Data", description: "Company Name and Vendor Code are mandatory." });
      return;
    }

    setIsSubmitting(true);

    try {
        // Prevent Duplicates
        const qCode = query(collection(db, "vendors"), where("vendorCode", "==", formData.vendorCode));
        const qSnap = await getDocs(qCode);
        if (!qSnap.empty) {
            toast({ variant: "destructive", title: "Duplicate", description: "Vendor Code already exists." });
            setIsSubmitting(false);
            return;
        }

        addDocumentNonBlocking(collection(db, "vendors"), { ...formData, createdAt: serverTimestamp() });
        toast({ title: "Success", description: "Service center registered." });
        router.push("/dashboard/vendors");
    } catch (err: any) {
        toast({ variant: "destructive", title: "Error", description: err.message });
        setIsSubmitting(false);
    }
  };

  if (isUserLoading || !user) return null;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}><ChevronLeft className="h-4 w-4" /></Button>
          <h1 className="text-3xl font-bold">New Service Center</h1>
        </div>
        <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Save Entry
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <Card>
          <CardHeader className="bg-muted/30 border-b"><CardTitle className="text-lg flex items-center gap-2"><Building2 className="h-5 w-5" /> Registration & Operations</CardTitle></CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2"><Label>Company Name</Label><Input value={formData.companyName} onChange={(e) => handleChange("companyName", e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Vendor Type</Label>
              <Select value={formData.vendorType} onValueChange={(v) => handleChange("vendorType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASP">ASP</SelectItem>
                  <SelectItem value="CALL BASIS TECHNICIAN">CALL BASIS TECHNICIAN</SelectItem>
                  <SelectItem value="OFFROLL TECHNICIAN">OFFROLL TECHNICIAN</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Joining Date</Label><Input type="date" value={formData.joiningDate} onChange={(e) => handleChange("joiningDate", e.target.value)} /></div>
            <div className="space-y-2"><Label>Associated Brands</Label><Input value={formData.associatedBrands} onChange={(e) => handleChange("associatedBrands", e.target.value)} /></div>
            <div className="space-y-2"><Label>Technicians Available</Label><Input value={formData.availableTechnicians} onChange={(e) => handleChange("availableTechnicians", e.target.value)} /></div>
            <div className="space-y-2"><Label>Coordinators Available</Label><Input value={formData.availableCoordinators} onChange={(e) => handleChange("availableCoordinators", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-muted/30 border-b"><CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Identification Details</CardTitle></CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2"><Label>Vendor Code (Unique)</Label><Input value={formData.vendorCode} onChange={(e) => handleChange("vendorCode", e.target.value)} /></div>
            <div className="space-y-2"><Label>Customer Code</Label><Input value={formData.customerCode} onChange={(e) => handleChange("customerCode", e.target.value)} /></div>
            <div className="space-y-2"><Label>PAN Number (Unique)</Label><Input value={formData.panNumber} onChange={(e) => handleChange("panNumber", e.target.value.toUpperCase())} /></div>
            <div className="space-y-2"><Label>GST Number</Label><Input value={formData.gstNumber} onChange={(e) => handleChange("gstNumber", e.target.value)} /></div>
            <div className="space-y-2"><Label>Aadhar Number</Label><Input value={formData.aadharNumber} onChange={(e) => handleChange("aadharNumber", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-muted/30 border-b"><CardTitle className="text-lg flex items-center gap-2"><User className="h-5 w-5" /> Ownership Info</CardTitle></CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2"><Label>Owner Name</Label><Input value={formData.ownerName} onChange={(e) => handleChange("ownerName", e.target.value)} /></div>
            <div className="space-y-2"><Label>Father's Name</Label><Input value={formData.ownersFatherName} onChange={(e) => handleChange("ownersFatherName", e.target.value)} /></div>
            <div className="space-y-2"><Label>Contact Number</Label><Input value={formData.contactNumber} onChange={(e) => handleChange("contactNumber", e.target.value)} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={formData.email} onChange={(e) => handleChange("email", e.target.value)} /></div>
            <div className="space-y-2"><Label>State</Label><Input value={formData.state} onChange={(e) => handleChange("state", e.target.value)} /></div>
            <div className="space-y-2"><Label>City</Label><Input value={formData.city} onChange={(e) => handleChange("city", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-muted/30 border-b"><CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5" /> Service Addresses & Coverage Areas</CardTitle></CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2"><Label>Establishment Address</Label><Textarea value={formData.establishmentAddress} onChange={(e) => handleChange("establishmentAddress", e.target.value)} /></div>
            <div className="space-y-2"><Label>Owner's Personal Address</Label><Textarea value={formData.ownerPersonalAddress} onChange={(e) => handleChange("ownerPersonalAddress", e.target.value)} /></div>
            <div className="space-y-2 md:col-span-2">
              <Label>Districts Covered (Comma-separated)</Label>
              <Input 
                value={formData.districtsCovered} 
                onChange={(e) => handleChange("districtsCovered", e.target.value)} 
                placeholder="e.g. Gurugram, Faridabad, Rohtak, Sonipat" 
              />
              <p className="text-xs text-muted-foreground">Specify the district names covered by this vendor. Separate each district with a comma.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-muted/30 border-b"><CardTitle className="text-lg flex items-center gap-2"><CreditCard className="h-5 w-5" /> Bank & Rates</CardTitle></CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2"><Label>Bank Name</Label><Input value={formData.bankName} onChange={(e) => handleChange("bankName", e.target.value)} /></div>
            <div className="space-y-2"><Label>Account Number</Label><Input value={formData.bankAccountNumber} onChange={(e) => handleChange("bankAccountNumber", e.target.value)} /></div>
            <div className="space-y-2"><Label>IFSC Code</Label><Input value={formData.ifscCode} onChange={(e) => handleChange("ifscCode", e.target.value)} /></div>
            <div className="space-y-2"><Label>Rate LC</Label><Input value={formData.rateLC} onChange={(e) => handleChange("rateLC", e.target.value)} /></div>
            <div className="space-y-2"><Label>Incentive MSL</Label><Input value={formData.incentiveMSL} onChange={(e) => handleChange("incentiveMSL", e.target.value)} /></div>
            <div className="space-y-2"><Label>TAT Penalty</Label><Input value={formData.tatPenalty} onChange={(e) => handleChange("tatPenalty", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card className="border-accent/20">
          <CardHeader className="bg-accent/5 border-b border-accent/10"><CardTitle className="text-lg flex items-center gap-2 text-accent"><BadgeCent className="h-5 w-5" /> Billing Recipient (Kajaria)</CardTitle></CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2"><Label>Bill To Address</Label><Textarea value={formData.billingAddress} onChange={(e) => handleChange("billingAddress", e.target.value)} /></div>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Bill To GSTIN</Label><Input value={formData.billingGstin} onChange={(e) => handleChange("billingGstin", e.target.value)} /></div>
              <div className="space-y-2">
                <Label>GST Type</Label>
                <Select value={formData.billingGstType} onValueChange={(v) => handleChange("billingGstType", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SGST+CGST">SGST + CGST</SelectItem>
                    <SelectItem value="IGST">IGST</SelectItem>
                    <SelectItem value="NON GST">NON GST</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
