import { PASSWORD_MIN_LENGTH, type SignUpInput, signUpSchema } from "@repo/shared";
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

export default function SignUpScreen() {
  const [form, setForm] = useState<SignUpInput>({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof SignUpInput, string>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setMessage(null);
    const parsed = signUpSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors<SignUpInput>(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      // Better Auth signs the new user in, so the route guard opens the app.
      const { error } = await authClient.signUp.email(parsed.data);
      if (error) setMessage(authErrorMessage(error));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreen title="Criar conta" subtitle="Leva menos de um minuto.">
      <View className="gap-4">
        <TextField
          label="Nome"
          value={form.name}
          onChangeText={(name) => setForm((f) => ({ ...f, name }))}
          error={errors.name}
          autoComplete="name"
          textContentType="name"
        />
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
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder={`Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`}
          onSubmitEditing={() => void submit()}
        />
        <FormMessage message={message} />
        <Button title="Criar conta" loading={submitting} onPress={() => void submit()} />
      </View>

      <SocialSignIn onError={setMessage} />

      <Text className="text-center text-sm text-neutral-600 dark:text-neutral-400">
        Já tem conta?{" "}
        <Link href="/sign-in" replace className="font-semibold text-neutral-900 dark:text-white">
          Entrar
        </Link>
      </Text>
    </AuthScreen>
  );
}
