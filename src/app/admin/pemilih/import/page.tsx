import { PageHeader } from "@/components/admin/PageHeader";
import { ImportWizard } from "@/components/admin/ImportWizard";
import { requireStaff } from "@/lib/auth/session";

export default async function ImportPage() {
  await requireStaff("import");
  return (
    <div>
      <PageHeader title="Import pemilih" subtitle="Data diperiksa dulu dan baru masuk setelah Anda mengonfirmasi. Nomor KK tidak disimpan utuh." />
      <ImportWizard />
    </div>
  );
}
