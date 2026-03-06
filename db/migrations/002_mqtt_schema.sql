-- MQTT + device monitoring schema update

-- Measurements: allow data from ESP32 MQTT (no pH yet)
ALTER TABLE public.latex_measurements
  ALTER COLUMN ph_value DROP NOT NULL;

-- Rename existing status -> quality_status to avoid collision with device status
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'latex_measurements'
      AND column_name = 'status'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'latex_measurements'
      AND column_name = 'quality_status'
  ) THEN
    ALTER TABLE public.latex_measurements RENAME COLUMN status TO quality_status;
  END IF;
END $$;

ALTER TABLE public.latex_measurements
  ALTER COLUMN owner_name SET DEFAULT 'Unknown';

ALTER TABLE public.latex_measurements
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS voltage_probe NUMERIC(8,3),
  ADD COLUMN IF NOT EXISTS battery_level NUMERIC(8,3),
  ADD COLUMN IF NOT EXISTS device_status TEXT,
  ADD COLUMN IF NOT EXISTS probe_status TEXT,
  ADD COLUMN IF NOT EXISTS firmware_version TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';

-- Update indexes
DROP INDEX IF EXISTS public.idx_measurements_status;
CREATE INDEX IF NOT EXISTS idx_measurements_quality_status ON public.latex_measurements(quality_status);
CREATE INDEX IF NOT EXISTS idx_measurements_device_id ON public.latex_measurements(device_id);

-- Devices table for online/offline + OTA monitor
CREATE TABLE IF NOT EXISTS public.devices (
  id TEXT PRIMARY KEY,
  wifi_connected BOOLEAN,
  mqtt_connected BOOLEAN,
  battery_level NUMERIC(8,3),
  firmware_version TEXT,
  last_seen TIMESTAMP WITH TIME ZONE,
  last_data_at TIMESTAMP WITH TIME ZONE,
  last_status_at TIMESTAMP WITH TIME ZONE,
  last_status TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS update_devices_updated_at ON public.devices;
CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_devices_last_seen ON public.devices(last_seen DESC);

-- Device logs (raw MQTT payload logging)
CREATE TABLE IF NOT EXISTS public.device_logs (
  id BIGSERIAL PRIMARY KEY,
  device_id TEXT REFERENCES public.devices(id) ON DELETE SET NULL,
  topic TEXT NOT NULL,
  payload JSONB NOT NULL,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  measurement_id UUID REFERENCES public.latex_measurements(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_device_logs_received_at ON public.device_logs(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_device_logs_device_id ON public.device_logs(device_id);

