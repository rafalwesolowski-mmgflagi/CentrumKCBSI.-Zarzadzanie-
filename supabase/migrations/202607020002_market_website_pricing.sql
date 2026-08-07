-- Add pricing detection fields to website analysis
alter table market_website_analysis
  add column if not exists price_range_text text,
  add column if not exists contact_email text,
  add column if not exists has_pricing_page boolean;
