'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Wrench } from "lucide-react";
import { useState, useEffect } from "react";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useUser } from "@/firebase";

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const { toast } = useToast();
    const router = useRouter();
    const { user, isUserLoading } = useUser();

    useEffect(() => {
      if (!isUserLoading && user) {
        router.push('/dashboard');
      }
    }, [user, isUserLoading, router]);


    if (isUserLoading || user) {
      return <div>Loading...</div>
    }

    const handleLogin = async () => {
        const auth = getAuth();
        try {
            await signInWithEmailAndPassword(auth, email, password);
            toast({ title: 'Login Successful' });
            router.push('/dashboard');
        } catch (error: any) {
            toast({ variant: "destructive", title: 'Login Failed', description: error.message });
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Card className="w-full max-w-sm">
                <CardHeader className="text-center">
                     <div className="flex justify-center items-center gap-2 mb-4">
                        <Wrench className="h-8 w-8 text-primary" />
                        <CardTitle className="text-2xl">TechReport</CardTitle>
                    </div>
                    <CardDescription>Enter your credentials to access your account</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" placeholder="m@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <Button type="submit" className="w-full" onClick={handleLogin}>
                        Login
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
