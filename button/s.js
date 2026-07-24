let btn=document.querySelector('button');
let url=window.location.href;

btn.addEventListener('click',()=>{
   let res=fetch('http://localhost:3000/api/create-order',{
    method:'POST',
    headers:{
        'Content-Type':'application/json'
    },
    body:JSON.stringify({
  "amount_inr": 100,
  "currency": "INR",
  "order_id": "MERC_DELL_9921",
  "customer_details": {
    "name": "Binod"
  },
 
  "callback_url": url,
  "cancel_url": "https://merchant.com/cart"
})
   })

    .then(res=>res.json())
    .then(data=>{    console.log(data);
      window.location.href=data.checkout_url;
    })
    .catch(err=>console.log(err))
});

console.log(url)