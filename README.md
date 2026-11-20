# Motion Atlas

Web demo môn Big Data (CO3137) và thiết kế luồng sự kiện video đa thiết bị. Mục tiêu nghiên cứu là dùng **10.000 video MicroLens** và lấy mẫu hành vi từ **KuaiRand**.

- [Thiết kế dữ liệu và nguồn](data/SOURCES.md)
- [Sơ đồ kiến trúc](docs/ARCHITECTURE.md)
- [Mẫu tệp đầu vào phát lại](data/examples/stream-input.ndjson)

Các tệp mẫu minh họa cấu trúc và kịch bản dữ liệu đến muộn, gửi lặp. Gói 10.000 video và pipeline nhập dữ liệu thực tế đang ở giai đoạn thiết kế.

## Chạy web

Cần Python 3.10 trở lên. Trên Windows, chạy `start-windows.cmd`. Trên macOS hoặc Linux, chạy `python3 server.py` rồi mở `http://localhost:3000`. Có thể dùng `npm start` để gọi máy chủ Python.

Kho video khởi đầu trống. Cài FFmpeg và ffprobe để tải lên tệp mới trong Provider Studio. Máy chủ lưu nội dung tải lên và tương tác trực tiếp trong `.runtime/` hoặc thư mục được cấu hình bằng `MOTION_DATA`.

Chạy kiểm thử với `python -m unittest discover -s tests -v`.
