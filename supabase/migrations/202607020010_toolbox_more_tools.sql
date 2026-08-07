-- Narzedziownik: add process-mapping, risk/decision, and scaling tool types

alter type toolbox_tool_type add value if not exists 'sipoc';
alter type toolbox_tool_type add value if not exists 'pdca';
alter type toolbox_tool_type add value if not exists 'premortem';
alter type toolbox_tool_type add value if not exists 'cynefin';
alter type toolbox_tool_type add value if not exists 'dilts';
alter type toolbox_tool_type add value if not exists 'okr';
