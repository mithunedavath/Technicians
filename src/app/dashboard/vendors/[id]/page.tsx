
"use client";

import { useState, useEffect } from "react";
import { doc, serverTimestamp } from "firebase/firestore";
import { useFirestore, useDoc, useUser, useMemoFirebase } from "@/firebase";
import { updateDocumentNonBlocking, deleteDocumentNonBlocking } from "@/firebase/non-blocking-updates";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";
import { 
  Building2, 
  User, 
  MapPin, 
  CreditCard, 
  ShieldCheck,
  BadgeCent,
  Loader2,
  CheckCircle2,
  Trash2,
  ChevronLeft,
  Briefcase,
  Link as LinkIcon
} from "lucide-react";

export default function VendorDetailPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const vendorId = params.id as string;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<any>(null);

  const vendorRef = useMemoFirebase(() => doc(db, "vendors", vendorId), [db, vendorId]);
  const { data: vendor, isLoading: isVendorLoading } = useDoc(vendorRef);

  useEffect(() => {
    if (!isUserLoading && !user) router.push('/login');
  }, [user, isUserLoading, router]);

  useEffect(() => {
    if (vendor) setFormData(vendor);
  }, [vendor]);

  const handleChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.companyName || !formData.vendorCode) {
      toast({ variant: "destructive", title: "Error", description: "Company Name and Vendor Code are mandatory." });
      return;
    }
    setIsSubmitting(true);
    updateDocumentNonBlocking(vendorRef, { ...formData, updatedAt: serverTimestamp() });
    toast({ title: "Updated", description: "Vendor details saved successfully." });
    setIsSubmitting(false);
  };

  const handleDelete = () => {
    if (!confirm("Are you sure?")) return;
    deleteDocumentNonBlocking(vendorRef);
    toast({ title: "Deleted", description: "Record removed." });
    router.push("/dashboard/vendors");
  };

  if (isUserLoading || isVendorLoading || !formData) {
    return <div className="p-24 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}><ChevronLeft className="h-4 w-4" /></Button>
          <div>
            <h1 className="text-3xl font-bold">{formData.companyName}</h1>
            <p className="text-muted-foreground font-mono text-sm">Code: {formData.vendorCode}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={handleDelete}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
          <Button onClick={handleUpdate} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />} Save
          </Button>
        </div>
      </div>

      <form onSubmit={handleUpdate} className="space-y-8">
        <Card>
          <CardHeader className="bg-muted/30 border-b"><CardTitle className="text-lg flex items-center gap-2"><Building2 className="h-5 w-5" /> Company & Operational Info</CardTitle></CardHeader>
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
          <CardHeader className="bg-muted/30 border-b"><CardTitle className="text-lg flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Identification & Codes</CardTitle></CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2"><Label>Vendor Code</Label><Input value={formData.vendorCode} onChange={(e) => handleChange("vendorCode", e.target.value)} /></div>
            <div className="space-y-2"><Label>Customer Code</Label><Input value={formData.customerCode} onChange={(e) => handleChange("customerCode", e.target.value)} /></div>
            <div className="space-y-2"><Label>PAN Number</Label><Input value={formData.panNumber} onChange={(e) => handleChange("panNumber", e.target.value.toUpperCase())} /></div>
            <div className="space-y-2"><Label>GST Number</Label><Input value={formData.gstNumber} onChange={(e) => handleChange("gstNumber", e.target.value)} /></div>
            <div className="space-y-2"><Label>Aadhar Number</Label><Input value={formData.aadharNumber} onChange={(e) => handleChange("aadharNumber", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-muted/30 border-b"><CardTitle className="text-lg flex items-center gap-2"><User className="h-5 w-5" /> Owner Info</CardTitle></CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2"><Label>Owner Name</Label><Input value={formData.ownerName} onChange={(e) => handleChange("ownerName", e.target.value)} /></div>
            <div className="space-y-2"><Label>Father's Name</Label><Input value={formData.ownersFatherName} onChange={(e) => handleChange("ownersFatherName", e.target.value)} /></div>
            <div className="space-y-2"><Label>Contact</Label><Input value={formData.contactNumber} onChange={(e) => handleChange("contactNumber", e.target.value)} /></div>
            <div className="space-y-2"><Label>Email</Label><Input value={formData.email} onChange={(e) => handleChange("email", e.target.value)} /></div>
            <div className="space-y-2"><Label>State</Label><Input value={formData.state} onChange={(e) => handleChange("state", e.target.value)} /></div>
            <div className="space-y-2"><Label>City</Label><Input value={formData.city} onChange={(e) => handleChange("city", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-muted/30 border-b"><CardTitle className="text-lg flex items-center gap-2"><MapPin className="h-5 w-5" /> Address Details & Coverage Areas</CardTitle></CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2"><Label>Establishment Address</Label><Textarea value={formData.establishmentAddress} onChange={(e) => handleChange("establishmentAddress", e.target.value)} /></div>
            <div className="space-y-2"><Label>Owner Personal Address</Label><Textarea value={formData.ownerPersonalAddress} onChange={(e) => handleChange("ownerPersonalAddress", e.target.value)} /></div>
            <div className="space-y-2 md:col-span-2">
              <Label>Districts Covered (Comma-separated)</Label>
              <Input 
                value={formData.districtsCovered || ""} 
                onChange={(e) => handleChange("districtsCovered", e.target.value)} 
                placeholder="e.g. Gurugram, Faridabad, Rohtak, Sonipat" 
              />
              <p className="text-xs text-muted-foreground">Specify the district names covered by this vendor. Separate each district with a comma.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="bg-muted/30 border-b"><CardTitle className="text-lg flex items-center gap-2"><CreditCard className="h-5 w-5" /> Financial & Rates</CardTitle></CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2"><Label>Bank Name</Label><Input value={formData.bankName} onChange={(e) => handleChange("bankName", e.target.value)} /></div>
            <div className="space-y-2"><Label>Account No</Label><Input value={formData.bankAccountNumber} onChange={(e) => handleChange("bankAccountNumber", e.target.value)} /></div>
            <div className="space-y-2"><Label>IFSC Code</Label><Input value={formData.ifscCode} onChange={(e) => handleChange("ifscCode", e.target.value)} /></div>
            <div className="space-y-2"><Label>Rate LC</Label><Input value={formData.rateLC} onChange={(e) => handleChange("rateLC", e.target.value)} /></div>
            <div className="space-y-2"><Label>Incentive MSL</Label><Input value={formData.incentiveMSL} onChange={(e) => handleChange("incentiveMSL", e.target.value)} /></div>
            <div className="space-y-2"><Label>TAT Penalty</Label><Input value={formData.tatPenalty} onChange={(e) => handleChange("tatPenalty", e.target.value)} /></div>
          </CardContent>
        </Card>

        <Card className="border-accent/20">
          <CardHeader className="bg-accent/5 border-b border-accent/10"><CardTitle className="text-lg flex items-center gap-2 text-accent"><BadgeCent className="h-5 w-5" /> Billing Recipient Details</CardTitle></CardHeader>
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

        <Card>
          <CardHeader className="bg-muted/30 border-b"><CardTitle className="text-lg flex items-center gap-2"><LinkIcon className="h-5 w-5" /> Document Links</CardTitle></CardHeader>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2"><Label>Document Folder Link</Label><Input value={formData.documentLink} onChange={(e) => handleChange("documentLink", e.target.value)} /></div>
            <div className="space-y-2"><Label>Agreement Link</Label><Input value={formData.agreementLink} onChange={(e) => handleChange("agreementLink", e.target.value)} /></div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
