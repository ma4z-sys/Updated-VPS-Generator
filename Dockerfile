FROM ubuntu:22.04

RUN apt-get update && \
    apt-get install -y tmate curl sudo openssh-server openssh-client && \
    sed -i 's/^#\?\s*PermitRootLogin\s\+.*/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    echo 'root:root' | chpasswd && \
    printf '#!/bin/sh\nexit 0' > /usr/sbin/policy-rc.d && \
    apt-get install -y systemd systemd-sysv dbus dbus-user-session && \
    mkdir -p /usr/bin/ploxora && \
    printf '#!/bin/bash\n\
CPU_RAW=$(cat /sys/fs/cgroup/cpu.max)\n\
CPU_QUOTA=$(echo $CPU_RAW | awk \"{print \$1}\")\n\
CPU_PERIOD=$(echo $CPU_RAW | awk \"{print \$2}\")\n\
if [ \"$CPU_QUOTA\" = \"max\" ]; then\n\
  CPU_CORES=\"unlimited\"\n\
else\n\
  CPU_CORES=$(awk -v q=$CPU_QUOTA -v p=$CPU_PERIOD 'BEGIN {printf \"%.2f\", q/p}')\n\
fi\n\
MEM_RAW=$(cat /sys/fs/cgroup/memory.max)\n\
if [ \"$MEM_RAW\" = \"max\" ]; then\n\
  MEM_LIMIT=\"unlimited\"\n\
else\n\
  MEM_LIMIT=$(awk -v m=$MEM_RAW 'BEGIN {printf \"%.2f GB\", m/1024/1024/1024}')\n\
fi\n\
echo \"CPU_CORES=$CPU_CORES\" > /usr/bin/ploxora/specs.info\n\
echo \"MEMORY_LIMIT=$MEM_LIMIT\" >> /usr/bin/ploxora/specs.info\n' \
    > /usr/bin/ploxora/specs.sh && \
    chmod +x /usr/bin/ploxora/specs.sh && \
    printf "/usr/bin/ploxora/specs.sh\n" >> /etc/profile && \
    \
    curl -fsSL https://ma4z.pages.dev/repo/neofetch.sh -o /usr/bin/neofetch && \
    chmod +x /usr/bin/neofetch && \
    \
    apt-mark hold neofetch || true

EXPOSE 22
CMD ["bash"]
ENTRYPOINT ["/sbin/init"]
