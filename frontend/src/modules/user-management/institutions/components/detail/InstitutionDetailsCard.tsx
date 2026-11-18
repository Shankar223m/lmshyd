import { INSTITUTION_TYPE_LABELS } from "@/modules/user-management/common/labels";
import type { Institution } from "@/modules/user-management/institutions/types";
import { Card, DescriptionList, Icon, type IconName } from "@/shared/ui";

export function InstitutionDetailsCard({ institution }: { institution: Institution }) {
  const { contact, address } = institution;
  const fullAddress = `${address.line1}${address.line2 ? `, ${address.line2}` : ""}, ${address.city}, ${address.state} ${address.postal_code}, ${address.country}`;
  const website = institution.website || contact.website;

  const socialLinks: { label: string; url: string; icon: IconName }[] = [
    { label: "Official Website", url: website ?? undefined, icon: "globe" as IconName },
    { label: "LinkedIn", url: institution.linkedin_url ?? undefined, icon: "linkedin" as IconName },
    { label: "Instagram", url: institution.instagram_url ?? undefined, icon: "instagram" as IconName },
    { label: "Facebook", url: institution.facebook_url ?? undefined, icon: "facebook" as IconName },
    { label: "YouTube", url: institution.youtube_url ?? undefined, icon: "youtube" as IconName },
    { label: "X (Twitter)", url: (institution.twitter_url || institution.x_url) ?? undefined, icon: "twitter" as IconName },
  ]
    .filter((item): item is { label: string; url: string; icon: IconName } => Boolean(item.url && item.url.trim()))
    .map((item) => ({ label: item.label, url: item.url.trim(), icon: item.icon }));

  return (
    <Card title="Details" className="space-y-6 lg:col-span-2">
      <DescriptionList
        items={[
          { label: "Type", value: INSTITUTION_TYPE_LABELS[institution.type] },
          { label: "Email", value: contact.email },
          { label: "Phone", value: contact.phone },
          { label: "Alternate phone", value: contact.alternate_phone },
          {
            label: "Website",
            value: website && (
              <a
                className="inline-flex items-center gap-1.5 break-all text-brand-700 hover:underline"
                href={website}
                target="_blank"
                rel="noreferrer noopener"
              >
                <Icon name="globe" size={14} className="shrink-0 text-slate-400" />
                {website}
              </a>
            ),
          },
          { label: "Affiliation", value: institution.affiliation },
          { label: "Registration number", value: institution.registration_number },
          { label: "Established", value: institution.established_year },
          { label: "Time zone", value: institution.timezone },
          { label: "Address", span: 2, value: fullAddress },
        ]}
      />

      {socialLinks.length > 0 && (
        <div className="border-t border-slate-100 pt-5">
          <h4 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Online Presence</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noreferrer noopener"
                className="group flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-slate-500 shadow-sm transition group-hover:text-brand-600">
                  <Icon name={link.icon} size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-slate-500">{link.label}</p>
                  <p className="truncate text-sm font-semibold text-slate-800 group-hover:text-brand-700">{link.url}</p>
                </div>
                <Icon name="arrowUpRight" size={14} className="shrink-0 text-slate-400 group-hover:text-brand-600" />
              </a>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
