    // 检查服务器状态
    async function checkServerStatus() {
      const status = document.getElementById("status");
      try {
        const res = await fetch("/api/rooms/info?_=" + Date.now(), { method: "GET", cache: "no-store" });
        if (res.ok) {
          status.textContent = "服务器状态：在线 :)  加入我们的QQ群：1049578201";
          status.classList.add("online");
          status.classList.remove("offline");
          status.classList.remove("cached");
        } else {
          throw new Error("无返回");
        }
      } catch (err) {
        status.textContent = "服务器状态：离线 :(  加入我们的QQ群：1049578201";
        status.classList.add("offline");
        status.classList.remove("online");
        status.classList.remove("cached");
      }
    }
