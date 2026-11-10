#pragma once
#include <string>
#include <map>
class Settings {public:
 inline static std::map<std::string,std::string> values;
 Settings(const std::string&,bool=false){}
 std::string GetString(const std::string& k,const std::string& d=""){return values.count(k)?values[k]:d;}
 void SetString(const std::string& k,const std::string& v){values[k]=v;}
 int GetInt(const std::string& k,int d=0){return values.count(k)?std::stoi(values[k]):d;}
 void SetInt(const std::string& k,int v){values[k]=std::to_string(v);}
};
