import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowRight, Download, ExternalLink, Eye, Loader2, PlusCircle } from "lucide-react";
import { DEFAULT_EVENT } from "./defaultEvent";
import {
  buildUpiQrDataUrl,
  buildWhatsAppUrl,
  feeLabelFromAmount,
  fetchEventConfig,
  formatEventDate,
  formatEventTime,
  getEventResource,
  getFacultyCoordinators,
  getPaymentDetails,
  getStudentCoordinators,
  getWhatsAppRedirect,
  heroFeeLabelFromAmount,
  openWhatsApp,
  REGISTER_ACCESS_TOKEN,
  REGISTER_ENDPOINT,
  teamLabelFromMembers,
  type SupabaseEventConfig,
} from "./eventApi";
import { eventConfigs, type EventConfig } from "./events";

const SUBMIT_TIMEOUT_MS = 15000;

const PLAIN = "—";

type FormState = {
  college: string;
  otherCollege: string;
  fullName: string;
  rollNumber: string;
  department: string;
  otherDepartment: string;
  year: string;
  mobile: string;
  email: string;
  member2Name: string;
  member2Roll: string;
  member2Mobile: string;
  member3Name: string;
  member3Roll: string;
  member3Mobile: string;
  transactionId: string;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

function phoneLink(phone: string) {
  return buildWhatsAppUrl(phone);
}

const initialForm: FormState = {
  college: "NNRG - Nalla Narasimha Reddy Education Society's Group of Institutions",
  otherCollege: "",
  fullName: "",
  rollNumber: "",
  department: "",
  otherDepartment: "",
  year: "",
  mobile: "",
  email: "",
  member2Name: "",
  member2Roll: "",
  member2Mobile: "",
  member3Name: "",
  member3Roll: "",
  member3Mobile: "",
  transactionId: "",
};

const colleges = [
  "NNRG - Nalla Narasimha Reddy Education Society's Group of Institutions",
  "GCTC - Geethanjali College of Engineering and Technology",
  "KPRIT - Kommuri Pratap Reddy Institute of Technology",
  "SITS - Siddhartha Institute of Technology & Sciences",
  "ANURAG - Anurag University, Hyderabad",
  "NMREC - Nalla Malla Reddy Engineering College",
  "Other",
];

const departments = ["CSE", "CSE (AI&ML)", "CSE (DS)", "ECE", "CIVIL", "IT", "Other"];
const years = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function eventFromUrl() {
  const pathSlug = window.location.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
  const querySlug = new URLSearchParams(window.location.search).get("event")?.toLowerCase();
  const defaultSlug = DEFAULT_EVENT.toLowerCase();
  const key = querySlug || pathSlug || defaultSlug;
  return eventConfigs.find((event) => event.route === key || event.slug === key) || eventConfigs[0];
}

function SectionHeading({ children, event }: { children: string; event: EventConfig }) {
  return (
    <h2 className="mb-10 text-center text-[30px] font-black uppercase tracking-[3px] sm:text-4xl" style={{ color: event.accent }}>
      {children}
    </h2>
  );
}

function FieldLabel({ children, event }: { children: string; event: EventConfig }) {
  return (
    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[2px]" style={{ color: event.accent }}>
      {children}
    </label>
  );
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  error,
  event,
  type = "text",
  label,
}: {
  id: keyof FormState;
  value: string;
  onChange: (id: keyof FormState, value: string) => void;
  placeholder: string;
  error?: string;
  event: EventConfig;
  type?: string;
  label?: string;
}) {
  return (
    <div className="mb-4" data-field={id}>
      <FieldLabel event={event}>{label || id.replace(/([A-Z])/g, " $1")}</FieldLabel>
      <input
        className={cx(
          "w-full rounded-lg border bg-white/5 px-4 py-3 text-[13px] text-white outline-none transition placeholder:text-white/25",
          error ? "border-red-500 animate-[shake_.28s_ease-in-out]" : "border-white/10"
        )}
        style={{ "--tw-ring-color": event.accent } as React.CSSProperties}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(changeEvent) => onChange(id, changeEvent.target.value)}
        onFocus={(focusEvent) => (focusEvent.currentTarget.style.borderColor = event.accent)}
        onBlur={(blurEvent) => (blurEvent.currentTarget.style.borderColor = error ? "#ef4444" : "rgba(255,255,255,0.1)")}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function SelectInput({
  id,
  value,
  onChange,
  options,
  placeholder,
  error,
  event,
  label,
}: {
  id: keyof FormState;
  value: string;
  onChange: (id: keyof FormState, value: string) => void;
  options: string[];
  placeholder: string;
  error?: string;
  event: EventConfig;
  label?: string;
}) {
  return (
    <div className="mb-4" data-field={id}>
      <FieldLabel event={event}>{label || id.replace(/([A-Z])/g, " $1")}</FieldLabel>
      <select
        className={cx(
          "w-full rounded-lg border bg-[#172231] px-4 py-3 text-[13px] text-white outline-none transition",
          error ? "border-red-500 animate-[shake_.28s_ease-in-out]" : "border-white/10"
        )}
        value={value}
        onChange={(changeEvent) => onChange(id, changeEvent.target.value)}
        onFocus={(focusEvent) => (focusEvent.currentTarget.style.borderColor = event.accent)}
        onBlur={(blurEvent) => (blurEvent.currentTarget.style.borderColor = error ? "#ef4444" : "rgba(255,255,255,0.1)")}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

function App() {
  const event = useMemo(() => eventFromUrl(), []);
  const [eventData, setEventData] = useState<SupabaseEventConfig | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [registrationNo, setRegistrationNo] = useState("");
  const [whatsappConfirmUrl, setWhatsappConfirmUrl] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const whatsappConfirmRef = useRef<HTMLDivElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const formOpenedAtRef = useRef<number>(Date.now());

  const displayCollege = useMemo(() => (form.college === "Other" ? form.otherCollege : form.college), [form.college, form.otherCollege]);
  const displayDepartment = useMemo(() => (form.department === "Other" ? form.otherDepartment : form.department), [form.department, form.otherDepartment]);

  const minMembers = eventData?.min_members ?? event.minMembers;
  const maxMembers = eventData?.max_members ?? event.maxMembers;
  const displayFee = eventData?.fee_amount ?? event.fee;
  const displayDate = eventData ? formatEventDate(eventData.event_date, PLAIN) : PLAIN;
  const displayTime = eventData
    ? formatEventTime(eventData.event_start_time, eventData.event_end_time, eventData.reporting_time, PLAIN)
    : PLAIN;
  const displayVenue = eventData?.venue?.trim() || PLAIN;
  const displayTeamLabel = eventData
    ? teamLabelFromMembers(minMembers, maxMembers, PLAIN)
    : PLAIN;
  const displayFeeLabel = eventData
    ? feeLabelFromAmount(displayFee, minMembers, maxMembers, `₹${displayFee}`)
    : PLAIN;
  const displayHeroFeeLabel = eventData
    ? heroFeeLabelFromAmount(displayFee, minMembers, maxMembers, `₹${displayFee}`)
    : PLAIN;
  const festYear = eventData?.fest_year ?? 2027;
  const registrationsOpen = eventData?.registrations_open === true;
  const payment = getPaymentDetails(eventData, event.fee);
  const whatsappRedirect = getWhatsAppRedirect(eventData);
  const facultyCoordinators = getFacultyCoordinators(eventData);
  const studentCoordinators = getStudentCoordinators(eventData);
  const otherStudentCoordinators = studentCoordinators.filter(
    (coordinator) =>
      !whatsappRedirect ||
      coordinator.name !== whatsappRedirect.name ||
      coordinator.phone !== whatsappRedirect.phone
  );
  const eventResource = getEventResource(eventData, event.name, festYear);

  useEffect(() => {
    formOpenedAtRef.current = Date.now();
    let active = true;
    fetchEventConfig(event.slug).then((config) => {
      if (active) setEventData(config);
    });
    return () => {
      active = false;
    };
  }, [event.slug]);

  // Local QR — no QuickChart network hop (that was the slow load).
  useEffect(() => {
    let active = true;
    if (!payment.upiId || !payment.upiName) {
      setQrUrl("");
      return;
    }
    const note = payment.note || event.name;
    buildUpiQrDataUrl(payment.upiId, payment.upiName, note).then((url) => {
      if (active) setQrUrl(url);
    });
    return () => {
      active = false;
    };
  }, [payment.upiId, payment.upiName, payment.note, event.name]);

  useEffect(() => {
    const title = `${event.name.toUpperCase()} — NNRG Tech Fest ${festYear}`;
    document.title = title;
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
    document
      .querySelector('meta[property="og:description"]')
      ?.setAttribute("content", `${event.name} | ${displayTeamLabel} | ${displayFeeLabel} | AI & ML Dept`);
  }, [event, festYear, displayTeamLabel, displayFeeLabel]);

  function updateForm(id: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [id]: value }));
    setErrors((current) => ({ ...current, [id]: undefined }));
  }

  function validate() {
    const nextErrors: FormErrors = {};
    if (!form.college) nextErrors.college = "College is required";
    if (form.college === "Other" && !form.otherCollege.trim()) nextErrors.otherCollege = "Enter your college name";
    if (!form.fullName.trim()) nextErrors.fullName = "Full name is required";
    if (!form.rollNumber.trim()) nextErrors.rollNumber = "Roll number is required";
    else if (!/^[0-9]{2}[A-Z0-9]{1,6}1A[0-9A-Z]{3,6}$/i.test(form.rollNumber.trim()) && !/^[0-9]{2}R21A[0-9]{4}$/i.test(form.rollNumber.trim())) {
      nextErrors.rollNumber = "Enter your real NNRG roll number (e.g. 227Z1A0587)";
    }
    if (!form.department) nextErrors.department = "Department is required";
    if (form.department === "Other" && !form.otherDepartment.trim()) nextErrors.otherDepartment = "Enter your department";
    if (!form.year) nextErrors.year = "Year is required";
    if (!/^[0-9]{10}$/.test(form.mobile)) nextErrors.mobile = "Enter a valid 10-digit mobile number";
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nextErrors.email = "Enter a valid email address";
    const member2Started = Boolean(form.member2Name.trim() || form.member2Roll.trim() || form.member2Mobile.trim());
    if (maxMembers >= 2 && member2Started) {
      if (!form.member2Name.trim()) nextErrors.member2Name = "Member 2 name is required";
      if (!form.member2Roll.trim()) nextErrors.member2Roll = "Member 2 roll number is required";
      if (!/^[0-9]{10}$/.test(form.member2Mobile)) nextErrors.member2Mobile = "Enter Member 2 valid 10-digit mobile";
    }
    const member3Started = Boolean(form.member3Name.trim() || form.member3Roll.trim() || form.member3Mobile.trim());
    if (maxMembers >= 3 && member3Started) {
      if (!form.member3Name.trim()) nextErrors.member3Name = "Member 3 name is required";
      if (!form.member3Roll.trim()) nextErrors.member3Roll = "Member 3 roll number is required";
      if (!/^[0-9]{10}$/.test(form.member3Mobile)) nextErrors.member3Mobile = "Enter Member 3 valid 10-digit mobile";
    }
    if (!form.transactionId.trim()) nextErrors.transactionId = "Transaction ID is required";
    else if (!/^[A-Za-z0-9][A-Za-z0-9/_-]{7,39}$/.test(form.transactionId.trim())) {
      nextErrors.transactionId = "Enter a valid UPI transaction ID from your payment app";
    }
    return nextErrors;
  }

  function scrollToError(nextErrors: FormErrors) {
    const first = Object.keys(nextErrors)[0];
    if (!first) return;
    formRef.current?.querySelector(`[data-field="${first}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function handleSubmit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (!registrationsOpen) {
      setErrors({ transactionId: "Registrations are not open yet. Please wait for the official college announcement." });
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      scrollToError(nextErrors);
      return;
    }

    setSubmitting(true);
    setRegistrationNo("");
    setWhatsappConfirmUrl("");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);

    const members = [
      maxMembers >= 2 && form.member2Name.trim()
        ? {
            full_name: form.member2Name.trim(),
            roll_number: form.member2Roll.trim(),
            department: displayDepartment,
            year: form.year,
            mobile: form.member2Mobile.trim(),
          }
        : null,
      maxMembers >= 3 && form.member3Name.trim()
        ? {
            full_name: form.member3Name.trim(),
            roll_number: form.member3Roll.trim(),
            department: displayDepartment,
            year: form.year,
            mobile: form.member3Mobile.trim(),
          }
        : null,
    ].filter(Boolean);

    try {
      const response = await fetch(REGISTER_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          event_slug: event.slug,
          college: displayCollege,
          other_college: form.college === "Other" ? form.otherCollege : null,
          team_name: maxMembers > 1 ? `${form.rollNumber}-${event.slug}-team` : null,
          leader_name: form.fullName,
          leader_certificate_name: form.fullName,
          leader_roll_number: form.rollNumber,
          leader_department: displayDepartment,
          leader_year: form.year,
          leader_mobile: form.mobile,
          leader_email: form.email.trim() || null,
          transaction_id: form.transactionId,
          amount_paid: displayFee,
          form_data: {
            event_focus: event.name,
          },
          members,
          hp_website: honeypotRef.current?.value || "",
          ...(REGISTER_ACCESS_TOKEN ? { access_token: REGISTER_ACCESS_TOKEN } : {}),
          form_opened_at: formOpenedAtRef.current,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.details ? `${result.error}: ${result.details}` : result.error || "Registration failed");
      }
      setRegistrationNo(result.registration_no);

      const member2 = maxMembers >= 2 ? (form.member2Name.trim() ? `${form.member2Name} (${form.member2Roll}) - ${form.member2Mobile}` : "Not added") : "Solo event";
      const member3 = maxMembers >= 3 ? (form.member3Name.trim() ? `${form.member3Name} (${form.member3Roll}) - ${form.member3Mobile}` : "Not added") : "";
      const messageText = `Hello! I have registered for *${event.name.toUpperCase()}* event at NNRG Tech Fest ${festYear}.

*Registration Details:*
━━━━━━━━━━━━━━━━
College: ${displayCollege}
Name: ${form.fullName}
Roll No: ${form.rollNumber}
Department: ${displayDepartment}
Year: ${form.year}
Mobile: ${form.mobile}
Email: ${form.email.trim() || "Not provided"}
${maxMembers >= 2 ? `Member 2: ${member2}` : ""}
${maxMembers >= 3 ? `Member 3: ${member3}` : ""}

*Payment Details:*
Amount Paid: ₹${displayFee}
Transaction ID: ${form.transactionId}
━━━━━━━━━━━━━━━━
Please verify my payment and confirm my registration for ${event.name}.
Thank you! 🙏`;

      const redirectPhone = result.whatsapp_redirect_phone || result.coordinator_phone || whatsappRedirect?.phone;
      if (!redirectPhone) {
        throw new Error("WhatsApp coordinator is not configured for this event yet.");
      }
      const whatsappUrl = buildWhatsAppUrl(redirectPhone, messageText);
      setWhatsappConfirmUrl(whatsappUrl);
      window.setTimeout(() => {
        whatsappConfirmRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
      openWhatsApp(whatsappUrl);
    } catch (error) {
      const message =
        error instanceof DOMException && error.name === "AbortError"
          ? "Network is slow. Please try again in a moment."
          : error instanceof Error
            ? error.message
            : "Could not submit registration";
      setErrors({ transactionId: message });
      document.querySelector('[data-field="transactionId"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
    } finally {
      window.clearTimeout(timeoutId);
      setSubmitting(false);
    }
  }

  const detailCards = [
    ["📅", "DATE", displayDate],
    ["⏰", "TIME", displayTime],
    ["📍", "VENUE", displayVenue],
    ["👥", "TEAM", displayTeamLabel],
    ["💰", "FEE", displayFeeLabel],
  ];

  return (
    <main
      className="min-h-screen bg-[#F5F5F5]"
      style={
        {
          "--event-accent": event.accent,
          "--event-accent-dark": event.accentDark,
          "--event-glow": event.glow,
        } as React.CSSProperties
      }
    >
      <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0D1117] px-5 py-16 text-center">
        <img
          src={event.heroImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center opacity-[.45]"
          decoding="async"
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(13,17,23,0.55)_0%,rgba(13,17,23,0.25)_40%,rgba(13,17,23,0.93)_100%)]" />
        {event.snippets.map((snippet, index) => (
          <span
            key={snippet}
            className={cx(
              "pointer-events-none absolute font-mono text-[13px]",
              ["left-[8%] top-[18%]", "right-[10%] top-[26%]", "left-[13%] bottom-[28%]", "right-[16%] bottom-[24%]", "left-[43%] top-[14%]"][index]
            )}
            style={{ color: `${event.accent}14` }}
          >
            {snippet}
          </span>
        ))}

        <div className="relative z-10 mx-auto w-full max-w-5xl">
          <div className="mb-5 font-mono text-[11px] text-white/35">visitor@nnrg:~$ ./launch {event.route} --year={festYear}</div>
          <div className="mb-6 inline-flex rounded-full px-5 py-1.5 text-[11px] font-bold uppercase tracking-[1px] text-black" style={{ background: event.accent }}>
            {event.badge}
          </div>
          <h1 className="mb-4 text-[56px] font-black leading-none tracking-[-3px] text-white sm:text-[100px]">
            {event.titleTop}
            <br />
            <span style={{ color: event.accent, textShadow: `0 0 80px ${event.glow}` }}>{event.titleAccent}</span>
          </h1>
          <p className="mb-8 text-base tracking-[3px] text-white/60">{event.subtitle}</p>
          <div className="mx-auto mb-8 flex max-w-4xl flex-wrap items-center justify-center gap-y-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-[13px] text-white/90 backdrop-blur">
            {[
              { icon: "📅", text: displayDate },
              { icon: "👥", text: displayTeamLabel },
              { icon: "📍", text: displayVenue },
              { icon: "💰", text: displayHeroFeeLabel },
            ].map((item, index) => (
              <div key={item.text} className={cx("flex items-center gap-2 px-4", index !== 3 && "border-r border-white/15")}>
                <span style={{ color: event.accent }}>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
          <a
            href="#register"
            className="accent-button mx-auto flex w-full max-w-[500px] items-center justify-center gap-2 rounded-xl px-6 py-[18px] text-[15px] font-bold text-black"
          >
            <ArrowDown size={18} /> Register Now <ArrowRight size={18} />
          </a>
          <div className="mt-10 text-[10px] font-bold uppercase tracking-[4px] text-white/20">↓ SCROLL TO EXPLORE ↓</div>
        </div>
        <div className="absolute bottom-12 right-12 z-10 hidden rounded-[14px] border border-white/10 bg-[#0D1117]/75 px-5 py-3 text-left backdrop-blur-xl md:block">
          <div className="text-[11px] text-[#9CA3AF]">Organizing by</div>
          <div className="text-[15px] font-bold text-white">AI & ML Department</div>
        </div>
      </section>

      <section className="below-fold px-5 py-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading event={event}>Event Details</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {detailCards.map(([emoji, label, value]) => (
              <div key={label} className="detail-card rounded-2xl border border-white/[.06] bg-[#0D1B2A] px-4 py-7 text-center">
                <div className="mb-4 text-4xl">{emoji}</div>
                <div className="mb-2 text-[11px] uppercase tracking-[2px] text-[#9CA3AF]">{label}</div>
                <div className="text-base font-bold" style={{ color: event.accent }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="below-fold px-5 pb-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading event={event}>Event Process</SectionHeading>
          <p className="mx-auto mb-8 max-w-2xl text-center text-sm text-[#6e7681]">{event.processSubtext}</p>
          <div className={cx("grid gap-4", event.rounds.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3")}>
            {event.rounds.map((round) => (
              <div key={round.label} className="rounded-2xl border border-white/[.06] bg-[#0D1B2A] p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-[1px] text-[#9CA3AF]">{round.label}</span>
                  <span className="rounded-full px-3 py-1 text-[11px] font-bold" style={{ background: round.color, color: round.badgeTextColor || "#000" }}>
                    {round.badge}
                  </span>
                </div>
                <h3 className="text-xl font-bold" style={{ color: round.color }}>{round.title}</h3>
                <div className="mt-3 text-sm font-bold text-white">{round.subheading}</div>
                <div className="mt-4 space-y-2">
                  {round.bullets.map((bullet) => (
                    <p key={bullet} className="text-[13px] leading-6 text-[#8b949e]">
                      <span style={{ color: round.color }}>►</span> {bullet}
                    </p>
                  ))}
                </div>
                {round.advance && (
                  <div className="mt-5 rounded-r-lg border-l-[3px] px-4 py-3 text-[13px] font-bold" style={{ borderColor: round.color, background: `${round.color}14`, color: round.color }}>
                    {round.advance}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {eventResource && (
        <section className="below-fold px-5 pb-20">
          <div className="mx-auto max-w-5xl">
            <h2
              className="mb-10 text-center text-[30px] font-black uppercase tracking-[3px] sm:text-4xl"
              style={{ color: event.accent }}
            >
              {eventResource.sectionHeading}
            </h2>
            <div className="mx-auto max-w-[760px] overflow-hidden rounded-2xl border border-white/[.06] bg-[#0D1B2A]">
              <div
                className="flex items-start gap-3 border-b px-5 py-4 text-[13px] leading-6"
                style={{ borderColor: `${event.accent}33`, background: `${event.accent}12`, color: event.accent }}
              >
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-black" style={{ background: event.accent }}>
                  i
                </span>
                <span>{eventResource.bannerText}</span>
              </div>
              <div className="px-6 py-10 text-center sm:px-10">
                <div
                  className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border"
                  style={{ borderColor: `${event.accent}44`, background: `${event.accent}10`, color: event.accent }}
                >
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                    <path d="M8 3h8l2 2h3v16H5V3h3Z" />
                    <path d="M8 3v4h10" />
                    <path d="M9 13h6M9 17h4" />
                  </svg>
                </div>
                <h3 className="text-[22px] font-bold text-white sm:text-[26px]">{eventResource.title}</h3>
                {eventResource.subtitle && (
                  <p className="mt-2 text-sm tracking-[1px] text-[#8b949e]">{eventResource.subtitle}</p>
                )}
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  {eventResource.viewUrl && (
                    <a
                      href={eventResource.viewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-bold transition hover:opacity-90"
                      style={{ borderColor: event.accent, color: event.accent, background: `${event.accent}10` }}
                    >
                      <Eye size={16} /> {eventResource.viewLabel}
                    </a>
                  )}
                  {eventResource.downloadUrl && (
                    <a
                      href={eventResource.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold text-black transition hover:opacity-90"
                      style={{ background: event.accent }}
                    >
                      <Download size={16} /> {eventResource.downloadLabel}
                    </a>
                  )}
                </div>
                <div
                  className="mx-auto mt-8 max-w-[620px] rounded-xl border px-4 py-3 text-left text-[13px] leading-6"
                  style={{ borderColor: `${event.accent}44`, background: `${event.accent}08`, color: event.accent }}
                >
                  💡 {eventResource.tip}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="below-fold px-5 pb-20">
        <div className="mx-auto max-w-5xl">
          <SectionHeading event={event}>Event Rules</SectionHeading>
          <div className="mx-auto max-w-[900px] rounded-2xl border border-white/[.06] bg-[#0D1B2A] p-8">
            {event.rules.map((rule, index) => (
              <div key={rule} className={cx("flex gap-5 py-4", index !== event.rules.length - 1 && "border-b border-white/[.06]")}>
                <span className="text-lg font-bold" style={{ color: event.accent }}>{String(index + 1).padStart(2, "0")}</span>
                <p className="text-[13px] leading-7 text-[#8b949e]">{rule}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="below-fold px-5 pb-20">
        <div className="mx-auto max-w-6xl">
          <SectionHeading event={event}>Prizes & Rewards</SectionHeading>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ["#001A1A", `${event.accent}66`, "🥇", "1ST PLACE", event.accent, event.firstPlaceTitle, ["💵 Cash Prize", "🎖 Certificate", "🏆 Trophy"]],
              ["#0D1B2A", "rgba(59,130,246,0.3)", "🥈", "2ND PLACE", "#60A5FA", "RUNNER-UP", ["💵 Cash Prize", "🎖 Certificate"]],
              ["#0D1117", "rgba(156,163,175,0.3)", "🥉", "3RD PLACE", "#9CA3AF", "FINALIST", ["💵 Cash Prize", "🎖 Certificate"]],
            ].map(([bg, border, icon, place, color, title, rewards]) => (
              <div key={String(place)} className="rounded-2xl p-7 text-center" style={{ background: String(bg), border: `1px solid ${border}` }}>
                <div className="mb-4 text-4xl">{icon}</div>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[3px]" style={{ color: String(color) }}>{place}</div>
                <div className="mb-5 text-[22px] font-black text-white">{title}</div>
                <div className="space-y-2 text-sm text-[#8b949e]">{(rewards as string[]).map((reward) => <div key={reward}>{reward}</div>)}</div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-center text-[13px] text-[#6e7681]">🎓 Every participant will receive a participation certificate</p>
        </div>
      </section>

      <section className="below-fold px-5 pb-20">
        <div className="mx-auto max-w-5xl">
          <SectionHeading event={event}>Payment Details</SectionHeading>
          <div className="mx-auto max-w-[700px] rounded-2xl border border-white/[.06] bg-[#0D1B2A] p-8">
            <div className="mb-7 border-l-[3px] px-4 py-3 text-xs font-bold" style={{ borderColor: event.accent, background: `${event.accent}14`, color: event.accent }}>
              ⚠ PAY FIRST, THEN FILL THE FORM | Keep your Transaction ID ready
            </div>
            <div className="mb-2 text-center text-[10px] font-bold uppercase tracking-[3px] text-[#6e7681]">Scan QR Code To Pay</div>
            <p className="mx-auto mb-4 max-w-md text-center text-xs leading-5 text-[#8b949e]">
              Scan the QR, then enter <strong style={{ color: event.accent }}>₹{payment.amount}</strong> manually in PhonePe / GPay / Paytm before confirming payment.
            </p>
            <div className="mx-auto mb-7 w-fit rounded-[10px] bg-white p-3">
              {qrUrl ? (
                <img
                  src={qrUrl}
                  alt={`${event.name} UPI payment QR code`}
                  className="h-[260px] w-[260px]"
                  decoding="sync"
                  fetchPriority="high"
                  width="260"
                  height="260"
                />
              ) : payment.upiId && payment.upiName ? (
                <div className="flex h-[260px] w-[260px] items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#6e7681]" aria-label="Generating QR" />
                </div>
              ) : (
                <div className="flex h-[260px] w-[260px] items-center justify-center px-6 text-center text-sm text-[#6e7681]">
                  Payment QR will appear once UPI details are added in Supabase.
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["UPI ID", payment.upiId || PLAIN, event.accent],
                ["PHONE", payment.upiPhone || PLAIN, event.accent],
                ["NAME", payment.upiName || PLAIN, "#FFFFFF"],
                ["AMOUNT", `₹${payment.amount} (enter manually)`, "#22C55E"],
              ].map(([label, value, color]) => (
                <div key={label} className="rounded-lg bg-white/5 p-4">
                  <div className="mb-1 text-[10px] uppercase tracking-[2px] text-[#6e7681]">{label}</div>
                  <div className="text-sm font-bold" style={{ color }}>{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-5 border-l-2 px-4 py-3 text-[13px]" style={{ borderColor: event.accent, background: `${event.accent}10`, color: event.accent }}>
              📋 Note: {payment.note || PLAIN}
            </div>
          </div>
        </div>
      </section>

      <section id="register" className="below-fold px-5 pb-24">
        <div className="mx-auto max-w-5xl">
          <SectionHeading event={event}>Registration Form</SectionHeading>
          {!registrationsOpen && (
            <div className="mx-auto mb-8 max-w-2xl rounded-2xl border border-amber-500/40 bg-amber-500/10 px-6 py-5 text-center">
              <div className="mb-2 text-lg font-black text-amber-300">Registrations Not Open Yet</div>
              <p className="text-sm leading-6 text-[#d4d4d8]">
                {event.name} registration for NNRG Tech Fest {festYear} will open when the college officially shares the link.
                Do not pay or submit until then.
              </p>
            </div>
          )}
          <p className="mx-auto mb-8 max-w-2xl text-center text-sm text-[#6e7681]">
            Fill in your details below. After submission, tap the WhatsApp button to send your registration confirmation to the coordinator.
          </p>
          <form ref={formRef} onSubmit={handleSubmit} className="mx-auto max-w-[760px] rounded-2xl border border-white/[.06] bg-[#0D1B2A] p-6 sm:p-9">
            <input
              ref={honeypotRef}
              type="text"
              name="company"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="pointer-events-none absolute -left-[9999px] h-0 w-0 opacity-0"
            />
            <SelectInput id="college" label="College *" value={form.college} onChange={updateForm} options={colleges} placeholder="Select college" error={errors.college} event={event} />
            {form.college === "Other" && (
              <TextInput id="otherCollege" value={form.otherCollege} onChange={updateForm} placeholder="Type your college name" error={errors.otherCollege} label="Other College *" event={event} />
            )}
            <h3 className="mb-4 mt-2 text-[15px] font-bold text-white">{maxMembers > 1 ? "Team Leader Details" : "Participant Details"}</h3>
            <TextInput id="fullName" value={form.fullName} onChange={updateForm} placeholder="Enter your full name" error={errors.fullName} label="Full Name *" event={event} />
            <div className="grid gap-4 md:grid-cols-3">
              <TextInput id="rollNumber" value={form.rollNumber} onChange={updateForm} placeholder="e.g. 22A91A0501" error={errors.rollNumber} label="Roll Number *" event={event} />
              <SelectInput id="department" label="Department *" value={form.department} onChange={updateForm} options={departments} placeholder="Department" error={errors.department} event={event} />
              <SelectInput id="year" label="Year *" value={form.year} onChange={updateForm} options={years} placeholder="Year" error={errors.year} event={event} />
            </div>
            {form.department === "Other" && (
              <TextInput id="otherDepartment" value={form.otherDepartment} onChange={updateForm} placeholder="Type your department" error={errors.otherDepartment} label="Other Department *" event={event} />
            )}
            <TextInput id="mobile" value={form.mobile} onChange={updateForm} placeholder="10-digit mobile number" error={errors.mobile} label="Mobile *" event={event} />
            <TextInput id="email" value={form.email} onChange={updateForm} placeholder="your@email.com (optional)" error={errors.email} type="email" label="Email" event={event} />
            {maxMembers >= 2 && (
              <>
                <h3 className="mb-4 mt-2 text-sm font-bold text-white">Member 2 (Optional)</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <TextInput id="member2Name" value={form.member2Name} onChange={updateForm} placeholder="Full Name" error={errors.member2Name} label="Full Name" event={event} />
                  <TextInput id="member2Roll" value={form.member2Roll} onChange={updateForm} placeholder="Roll Number" error={errors.member2Roll} label="Roll Number" event={event} />
                  <TextInput id="member2Mobile" value={form.member2Mobile} onChange={updateForm} placeholder="10-digit mobile" error={errors.member2Mobile} label="WhatsApp Number" event={event} />
                </div>
              </>
            )}
            {maxMembers >= 3 && (
              <>
                <h3 className="mb-4 mt-2 text-sm font-bold text-white">Member 3 (Optional)</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <TextInput id="member3Name" value={form.member3Name} onChange={updateForm} placeholder="Full Name" error={errors.member3Name} label="Full Name" event={event} />
                  <TextInput id="member3Roll" value={form.member3Roll} onChange={updateForm} placeholder="Roll Number" error={errors.member3Roll} label="Roll Number" event={event} />
                  <TextInput id="member3Mobile" value={form.member3Mobile} onChange={updateForm} placeholder="10-digit mobile" error={errors.member3Mobile} label="WhatsApp Number" event={event} />
                </div>
              </>
            )}
            <TextInput id="transactionId" value={form.transactionId} onChange={updateForm} placeholder="UPI Transaction ID after payment" error={errors.transactionId} label="Transaction ID *" event={event} />

            <div className="mb-4 border-l-[3px] px-4 py-3 text-[13px] leading-6" style={{ borderColor: event.accent, background: `${event.accent}10`, color: event.accent }}>
              💡 Reminder: Scan QR or pay to UPI ID <strong>{payment.upiId || PLAIN}</strong>, enter <strong>₹{payment.amount}</strong> manually, then paste your Transaction ID above.
            </div>
            <div className="mb-5 border-l-[3px] border-[#22C55E] bg-[#22C55E]/[.06] px-4 py-3 text-[13px] leading-6 text-[#22C55E]">
              🟢 After submit: Tap the green WhatsApp button
              {whatsappRedirect?.name ? ` to message ${whatsappRedirect.name}.` : " once the coordinator is configured in Supabase."}
              {" "}Some browsers block auto-redirect — the button always works.
            </div>

            {registrationNo && whatsappConfirmUrl && (
              <div
                ref={whatsappConfirmRef}
                className="mb-5 rounded-xl border-2 border-[#25D366]/40 bg-[#25D366]/10 px-5 py-5 text-center"
              >
                <div className="mb-1 text-sm font-bold text-[#22C55E]">Registration saved: {registrationNo}</div>
                <p className="mb-4 text-xs leading-5 text-[#8b949e]">
                  WhatsApp should open automatically. If it did not, tap the button below — this works in every browser.
                </p>
                <a
                  href={whatsappConfirmUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#25D366] px-5 py-4 text-[15px] font-bold text-white transition active:scale-[.98]"
                >
                  Open WhatsApp & Send Confirmation <ExternalLink size={18} />
                </a>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !registrationsOpen}
              className="flex w-full items-center justify-center gap-2 rounded-[10px] px-5 py-[18px] text-[15px] font-bold text-black transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-70"
              style={{ background: event.accent }}
            >
              {submitting ? <Loader2 className="animate-spin" size={19} /> : <PlusCircle size={19} />}
              {!registrationsOpen
                ? "Registrations Closed"
                : submitting
                  ? "Submitting..."
                  : "Submit Registration & Open WhatsApp"}{" "}
              {registrationsOpen && !submitting ? <ArrowRight size={18} /> : null}
            </button>
            <p className="mt-5 text-center text-[11px] leading-5 text-[#6e7681]">
              By submitting, you agree to the event rules and confirm that your payment has been made. All decisions by the organizing committee are final.
            </p>
          </form>
        </div>
      </section>

      <footer className="relative overflow-hidden bg-black px-5 py-16">
        <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center text-center text-[clamp(60px,12vw,160px)] font-black uppercase tracking-[8px] text-white/[.03]">
          TECH FEST {festYear}
        </div>
        <div className="relative z-10 mx-auto max-w-5xl">
          <h2 className="mb-10 text-center text-[28px] font-bold text-white">NEED HELP?</h2>
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[3px] text-white/30">Faculty Coordinators</div>
              {facultyCoordinators.length ? facultyCoordinators.map((coordinator) => (
                <div key={`${coordinator.name}-${coordinator.phone}`} className="mb-1.5 flex items-center justify-between rounded-md border border-[#21262d] bg-[#0D1117] px-4 py-3">
                  <span className="text-sm font-bold text-white">{coordinator.name}</span>
                  <span className="text-xs text-white/40">{coordinator.phone || PLAIN}</span>
                </div>
              )) : (
                <div className="rounded-md border border-[#21262d] bg-[#0D1117] px-4 py-3 text-xs text-white/30">No faculty coordinators added yet.</div>
              )}
            </div>
            <div>
              <div className="mb-3 text-[10px] font-bold uppercase tracking-[3px] text-white/30">Student Coordinators</div>
              {whatsappRedirect?.phone ? (
                <a href={phoneLink(whatsappRedirect.phone)} target="_blank" rel="noreferrer" className="mb-1.5 flex items-center justify-between rounded-r-md border-l-4 px-4 py-3.5" style={{ borderColor: event.accent, background: `${event.accent}12` }}>
                  <span>
                    <span className="mb-1 block text-[8px] uppercase" style={{ color: `${event.accent}99` }}>Student Coordinator</span>
                    <span className="text-base font-bold" style={{ color: event.accent }}>{whatsappRedirect.name}</span>
                  </span>
                  <span className="flex items-center gap-1 text-[13px] font-bold" style={{ color: event.accent }}>
                    {whatsappRedirect.phone} <ExternalLink size={14} />
                  </span>
                </a>
              ) : (
                <div className="mb-1.5 rounded-md border border-[#21262d] bg-[#0D1117] px-4 py-3 text-xs text-white/30">No primary student coordinator added yet.</div>
              )}
              {otherStudentCoordinators.map((coordinator) => (
                <div key={`${coordinator.name}-${coordinator.phone}`} className="mb-1.5 flex items-center justify-between rounded-md border border-[#21262d] bg-[#0D1117] px-4 py-3">
                  <span>
                    <span className="mb-1 block text-[8px] uppercase text-white/30">Student Coordinator</span>
                    <span className="text-sm font-bold text-white">{coordinator.name}</span>
                  </span>
                  <span className="text-xs text-white/40">{coordinator.phone || PLAIN}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/[.07] pt-4 text-[10px] text-white/20">
            <span>Developed by the Department CSM</span>
            <span>© {festYear} NNRG Fest. All rights reserved.</span>
            {whatsappRedirect?.phone ? (
              <a href={phoneLink(whatsappRedirect.phone)} target="_blank" rel="noreferrer" className="flex items-center gap-1" style={{ color: event.accent }}>
                Designed by {whatsappRedirect.name} <ExternalLink size={12} />
              </a>
            ) : (
              <span>Designed by NNRG Tech Fest</span>
            )}
          </div>
        </div>
      </footer>
    </main>
  );
}

export default App;
