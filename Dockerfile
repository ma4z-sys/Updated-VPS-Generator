FROM ubuntu:22.04

RUN apt-get update && \
    apt-get install -y tmate curl sudo neofetch openssh-server openssh-client && \
    sed -i 's/^#\?\s*PermitRootLogin\s\+.*/PermitRootLogin yes/' /etc/ssh/sshd_config && \
    echo 'root:root' | chpasswd && \
    printf '#!/bin/sh\nexit 0' > /usr/sbin/policy-rc.d && \
    apt-get install -y systemd systemd-sysv dbus dbus-user-session && \
    printf "systemctl start systemd-logind" >> /etc/profile

ENV VPS_NAME=Ploxora

RUN echo ': "${VPS_NAME:=Ploxora}"' >> /etc/bash.bashrc && \
    echo 'export PS1="root@${VPS_NAME}:\w# "' >> /etc/bash.bashrc && \
    echo 'hostname "Ploxora VPS - ${VPS_NAME}"' >> /etc/bash.bashrc

CMD ["bash"]
ENTRYPOINT ["/sbin/init"]
