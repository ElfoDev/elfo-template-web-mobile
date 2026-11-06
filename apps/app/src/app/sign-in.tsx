import { type SignInInput, signInSchema } from "@repo/shared";
import { Link } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { AuthScreen } from "@/components/auth-screen";
import { Button } from "@/components/button";
import { FormMessage } from "@/components/form-message";
import { SocialSignIn } from "@/components/social-sign-in";
import { TextField } from "@/components/text-field";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { fieldErrors } from "@/lib/form-errors";

export default function SignInScreen() {
  const [form, setForm] = useState<SignInInput>({ email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof SignInInput, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setMessage(null);
    const parsed = signInSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors<SignInInput>(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      // On success the session changes and the route guard opens the app.
      const { error } = await authClient.signIn.email(parsed.data);
      if (error) setMessage(authErrorMessage(error));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen title="Entrar" subtitle="Acesse sua conta para ver suas tarefas.">
      <View className="gap-4">
        <TextField
          label="E-mail"
          value={form.email}
          onChangeText={(email) => setForm((f) => ({ ...f, email }))}
          error={errors.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="voce@exemplo.com"
        />
        <TextField
          label="Senha"
          value={form.password}
          onChangeText={(password) => setForm((f) => ({ ...f, password }))}
          error={errors.password}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
          onSubmitEditing={() => void submit()}
        />
        <FormMessage message={message} />
        <Button title="Entrar" loading={submitting} onPress={() => void submit()} />
      </View>

      <SocialSignIn onError={setMessage} />

      <Text className="text-center text-sm text-neutral-600 dark:text-neutral-400">
        Não tem conta?{" "}
        <Link href="/sign-up" replace className="font-semibold text-neutral-900 dark:text-white">
          Cadastre-se
        </Link>
      </Text>
    </AuthScreen>
  );
}
