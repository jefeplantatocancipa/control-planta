import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FasalactWordmark } from "@/components/fasalact-wordmark";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <FasalactWordmark size="lg" />
          <p className="mt-2 text-sm text-muted-foreground">
            Control de Planta — ingresa con tu cuenta para registrar y
            consultar el proceso.
          </p>
        </CardHeader>
        <CardContent>
          <LoginForm redirectTo={redirectTo} />
        </CardContent>
      </Card>
    </div>
  );
}
