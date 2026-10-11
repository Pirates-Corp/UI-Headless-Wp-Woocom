module.exports = {
  apps: [
    {
      name: "Clay_Brush_Ecomm_Website_Dev",

      cwd: "/var/lib/jenkins/workspace/Clay Brush Ecomm Website Dev",

      script: "pnpm",
      // script: "node_modules/next/dist/bin/next",
      // args: "run start -p 4121",

      instances: 1,
      exec_mode: "fork",

      autorestart: true,
      watch: false,
      max_memory_restart: "1G",

      env: {
        NODE_ENV: "production",
      },

      time: true,
      kill_timeout: 5000,
      restart_delay: 3000,
    },
  ],
};
