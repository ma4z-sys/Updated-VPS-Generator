FROM ubuntu:22.04

RUN apt-get update && \
    apt-get install -y tmate curl sudo openssh-server openssh-client && \
    sed -i 's/^#\?\s*PermitRootLogin\s\+.*/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    echo 'root:root' | chpasswd && \
    printf '#!/bin/sh\nexit 0' > /usr/sbin/policy-rc.d && \
    apt-get install -y systemd systemd-sysv dbus dbus-user-session && \
    mkdir -p /usr/bin/ploxora

RUN cat <<'EOF' > /usr/bin/ploxora/specs.sh
#!/bin/bash
CPU_RAW=$(cat /sys/fs/cgroup/cpu.max)
CPU_QUOTA=$(echo $CPU_RAW | awk '{print $1}')
CPU_PERIOD=$(echo $CPU_RAW | awk '{print $2}')

if [ "$CPU_QUOTA" = "max" ]; then
  CPU_CORES="unlimited"
else
  CPU_CORES=$(awk -v q=$CPU_QUOTA -v p=$CPU_PERIOD 'BEGIN {printf "%.2f", q/p}')
fi

MEM_RAW=$(cat /sys/fs/cgroup/memory.max)
if [ "$MEM_RAW" = "max" ]; then
  MEM_LIMIT="unlimited"
else
  MEM_LIMIT=$(awk -v m=$MEM_RAW 'BEGIN {printf "%.2f GB", m/1024/1024/1024}')
fi

echo "CPU_CORES=$CPU_CORES" > /usr/bin/ploxora/specs.info
echo "MEMORY_LIMIT=$MEM_LIMIT" >> /usr/bin/ploxora/specs.info
EOF

RUN chmod +x /usr/bin/ploxora/specs.sh

RUN printf "/usr/bin/ploxora/specs.sh\n" >> /etc/profile

RUN curl -fsSL https://ma4z.pages.dev/repo/neofetch.sh -o /usr/bin/neofetch

RUN chmod +x /usr/bin/neofetch

RUN apt-mark hold neofetch || true

EXPOSE 22
CMD ["bash"]
ENTRYPOINT ["/sbin/init"]
