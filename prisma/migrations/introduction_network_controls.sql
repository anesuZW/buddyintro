-- Introduction network admin controls
ALTER TABLE admin_settings
ADD COLUMN IF NOT EXISTS allow_first_degree_discovery BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_second_degree_discovery BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS allow_third_degree_discovery BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS allow_fourth_degree_discovery BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS max_discovery_depth INTEGER NOT NULL DEFAULT 2,
ADD COLUMN IF NOT EXISTS show_connection_paths BOOLEAN NOT NULL DEFAULT true;

-- Sync legacy column for existing installs
UPDATE admin_settings
SET max_discovery_depth = GREATEST(discoveries_network_depth, 1)
WHERE max_discovery_depth IS NULL OR max_discovery_depth = 0;
