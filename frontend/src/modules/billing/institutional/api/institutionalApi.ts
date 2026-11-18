import { baseApi } from "@/core/api/baseApi";

/** Shape expected by the course-management catalog UI. */
export type AdminCoursePricing = {
  course_id: string;
  course_title?: string;
  course_code?: string;
  slug?: string;
  category?: string;
  individual_price_paise?: number;
  institutional_price_per_seat_paise?: number;
  fixed_price_paise?: number;
  monthly_price_paise?: number;
  hourly_price_paise?: number;
  pricing_method?: string;
  discount_type?: string;
  discount_percent?: number;
  discount_paise?: number;
  gst_percent?: number;
  min_students?: number;
  max_students?: number;
};

export type AdminCoursePricingAudit = {
  id?: string;
  course_id: string;
  changed_at?: string;
  created_at?: string;
  changed_by?: string;
  reason?: string;
  admin_email?: string;
  admin_name?: string;
  admin_user_id?: string;
  previous_individual_price_paise?: number;
  new_individual_price_paise?: number;
  previous_institutional_price_paise: number;
  new_institutional_price_paise: number;
};

type UpdateAdminCoursePricingBody = AdminCoursePricing & {
  reason: string;
  discount_type?: string;
};

type PriceOut = {
  price_id: string;
  kind: string;
  code: string;
  name: string;
  unit_amount: number;
  meta?: { valid_days?: number };
};

type PricePage = { prices: PriceOut[] };

function mapPrice(price: PriceOut): AdminCoursePricing {
  return {
    course_id: price.code,
    course_title: price.name,
    individual_price_paise: price.unit_amount,
    institutional_price_per_seat_paise: price.unit_amount,
    fixed_price_paise: price.unit_amount,
    monthly_price_paise: price.unit_amount,
    pricing_method: "fixed",
    gst_percent: 18,
  };
}

const institutionalApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    getAdminCoursePricing: build.query<AdminCoursePricing[], void>({
      query: () => ({ url: "/admin/prices", params: { kind: "course_seat", per_page: 100 } }),
      transformResponse: (response: PricePage) => (response.prices ?? []).map(mapPrice),
      providesTags: ["Prices"],
    }),
    updateAdminCoursePricing: build.mutation<void, UpdateAdminCoursePricingBody>({
      async queryFn(body, _api, _extra, baseQuery) {
        const list = await baseQuery({
          url: "/admin/prices",
          params: { kind: "course_seat", per_page: 100 },
        });
        if (list.error) return { error: list.error };
        const prices = (list.data as PricePage)?.prices ?? [];
        const existing = prices.find((p) => p.code === String(body.course_id));
        const unit =
          body.individual_price_paise ??
          body.fixed_price_paise ??
          body.institutional_price_per_seat_paise ??
          0;
        const name = (body.course_title || existing?.name || `Course ${body.course_id}`).slice(0, 160);

        if (existing) {
          const patch = await baseQuery({
            url: `/admin/prices/${existing.price_id}`,
            method: "PATCH",
            body: { name, unit_amount: unit },
          });
          if (patch.error) return { error: patch.error };
        } else {
          const created = await baseQuery({
            url: "/admin/prices",
            method: "POST",
            body: {
              kind: "course_seat",
              code: String(body.course_id),
              name,
              unit_amount: unit,
              valid_days: 365,
            },
          });
          if (created.error) return { error: created.error };
        }
        return { data: undefined };
      },
      invalidatesTags: ["Prices"],
    }),
    getAdminCoursePricingAudits: build.query<AdminCoursePricingAudit[], string | number>({
      queryFn: async () => ({ data: [] as AdminCoursePricingAudit[] }),
      providesTags: ["Prices"],
    }),
  }),
});

export const {
  useGetAdminCoursePricingQuery,
  useUpdateAdminCoursePricingMutation,
  useGetAdminCoursePricingAuditsQuery,
} = institutionalApi;