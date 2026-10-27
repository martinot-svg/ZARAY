-- Wi-Fi ticket templates: additive visual preferences only.
-- NEVER change voucher generation, access credentials, sheet dimensions, RLS or offer rules.
alter table public.ticket_templates
 add column if not exists template_key text,
 add column if not exists accent_color text,
 add column if not exists gradient_enabled boolean,
 add column if not exists decorations_enabled boolean,
 add column if not exists brand_name text,
 add column if not exists wifi_ssid text,
 add column if not exists phone text,
 add column if not exists address text,
 add column if not exists welcome_message text,
 add column if not exists footer_text text,
 add column if not exists show_price boolean,
 add column if not exists show_duration boolean,
 add column if not exists show_ticket_id boolean,
 add column if not exists show_wifi_ssid boolean;

alter table public.ticket_templates
 add constraint ticket_template_key_valid
 check (template_key is null or template_key in ('classic','event','minimal','corporate')),
 add constraint ticket_template_accent_valid
 check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$'),
 add constraint ticket_template_brand_len
 check (brand_name is null or char_length(brand_name)<=90),
 add constraint ticket_template_ssid_len
 check (wifi_ssid is null or char_length(wifi_ssid)<=64),
 add constraint ticket_template_phone_len
 check (phone is null or char_length(phone)<=60),
 add constraint ticket_template_address_len
 check (address is null or char_length(address)<=160),
 add constraint ticket_template_welcome_len
 check (welcome_message is null or char_length(welcome_message)<=120),
 add constraint ticket_template_footer_len
 check (footer_text is null or char_length(footer_text)<=100);
-- Existing rows remain valid and the original "classic" renderer is the default.
